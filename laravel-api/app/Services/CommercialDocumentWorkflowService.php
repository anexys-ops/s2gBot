<?php

namespace App\Services;

use App\Models\BonCommande;
use App\Models\BonCommandeLigne;
use App\Models\BonLivraison;
use App\Models\BonLivraisonLigne;
use App\Models\DocumentSequence;
use App\Models\Dossier;
use App\Models\Quote;
use App\Models\QuoteLine;
use App\Models\User;
use App\Support\ClientFilialeResolver;
use Illuminate\Support\Facades\DB;

class CommercialDocumentWorkflowService
{
    public function __construct(
        private readonly DocumentSequenceService $sequences,
        private readonly BonCommandeTotalsService $bonCommandeTotals,
    ) {}

    public function createBonCommandeFromQuote(
        Quote $quote,
        User $user,
        bool $bcClientEnAttente = false,
        ?array $jalonIds = null,
    ): BonCommande
    {
        if (! $quote->dossier_id) {
            throw new \InvalidArgumentException('Devis sans dossier : impossible de créer un bon de commande.');
        }

        if (! in_array($quote->status, [Quote::STATUS_SIGNED, Quote::STATUS_ACCEPTED], true)) {
            throw new \InvalidArgumentException('Le devis doit être accepté (signé ou accepté) pour générer un BC.');
        }

        $quote->load('quoteLines');

        return DB::transaction(function () use ($quote, $user, $bcClientEnAttente, $jalonIds) {
            $numero = $this->sequences->next(
                DocumentSequence::TYPE_BON_COMMANDE,
                ClientFilialeResolver::codeForQuote($quote),
            );

            $centreGroupId = $quote->lab_centre_group_id
                ?: Dossier::query()->whereKey($quote->dossier_id)->value('lab_centre_group_id');

            $bc = BonCommande::query()->create([
                'numero' => $numero,
                'quote_id' => $quote->id,
                'dossier_id' => $quote->dossier_id,
                'lab_centre_group_id' => $centreGroupId ?: null,
                'client_id' => $quote->client_id,
                'contact_id' => $quote->contact_id,
                'statut' => BonCommande::STATUT_BROUILLON,
                'bc_client_en_attente' => $bcClientEnAttente,
                'date_commande' => now()->toDateString(),
                'date_livraison_prevue' => $quote->site_delivery_date,
                'montant_ht' => $quote->amount_ht,
                'montant_ttc' => $quote->amount_ttc,
                'tva_rate' => $quote->tva_rate,
                'notes' => $quote->notes,
                'created_by' => $user->id,
            ]);

            $ordre = 0;
            $quoteMeta = is_array($quote->meta) ? $quote->meta : [];
            $documentTva = (float) $quote->tva_rate;

            // Sélection des jalons à transférer (null = tous). Un jalon sans id stable
            // est identifié par sa position (« idx-N »).
            $allJalons = array_values(array_filter($quoteMeta['devis_jalons'] ?? [], 'is_array'));
            $jalonKey = fn (array $jalon, int $idx): string => (string) ($jalon['id'] ?? 'idx-'.$idx);
            $selectedJalons = [];
            foreach ($allJalons as $idx => $jalon) {
                if ($jalonIds === null || in_array($jalonKey($jalon, $idx), $jalonIds, true)) {
                    $selectedJalons[] = $jalon;
                }
            }
            $restrictJalons = $jalonIds !== null;
            $refsOfJalons = fn (array $jalons): array => array_values(array_unique(array_map(
                'intval',
                array_merge(...array_map(fn ($j) => (array) ($j['product_ref_article_ids'] ?? []), $jalons ?: [[]])),
            )));
            $selectedRefIds = $refsOfJalons($selectedJalons);
            $allRefIds = $refsOfJalons($allJalons);
            // Quantité d'un jalon forfait reprise à l'identique sur chacune de ses lignes de détail.
            $forfaitQtyByRef = [];
            foreach ($selectedJalons as $jalon) {
                if (! QuotePricingService::isJalonForfait($jalon)) {
                    continue;
                }
                foreach ((array) ($jalon['product_ref_article_ids'] ?? []) as $refId) {
                    $forfaitQtyByRef[(int) $refId] ??= max(1, (int) ($jalon['quantity'] ?? 1));
                }
            }

            // Step 1: copy ALL quote lines — forfait product lines included
            /** @var QuoteLine $line */
            foreach ($quote->quoteLines as $line) {
                $refId = (int) $line->ref_article_id;
                if ($restrictJalons && $refId > 0 && in_array($refId, $allRefIds, true) && ! in_array($refId, $selectedRefIds, true)) {
                    continue;
                }
                $qty = (float) ($forfaitQtyByRef[$refId] ?? $line->quantity);
                BonCommandeLigne::query()->create([
                    'bon_commande_id' => $bc->id,
                    'ref_article_id' => $line->ref_article_id,
                    'libelle' => $line->description,
                    'ordre' => $ordre++,
                    'quantite' => $qty,
                    'quantite_devis' => $qty,
                    'prix_unitaire_ht' => (float) $line->unit_price,
                    'tva_rate' => (float) $line->tva_rate,
                    'montant_ht' => (float) $line->total,
                ]);
            }

            // Step 2: append forfait summary lines so prices are visible and editable
            if (QuotePricingService::isDocumentForfait($quoteMeta)) {
                $globalHt = round(max(0.0, (float) ($quoteMeta['tarif_global_hors_lignes_ht'] ?? 0)), 2);
                if ($globalHt > 0) {
                    $qty = max(1, (int) ($quoteMeta['tarif_global_quantity'] ?? 1));
                    BonCommandeLigne::query()->create([
                        'bon_commande_id' => $bc->id,
                        'ref_article_id' => null,
                        'libelle' => $quoteMeta['tarif_global_designation'] ?? 'Prestation forfaitaire',
                        'ordre' => $ordre++,
                        'quantite' => $qty,
                        'quantite_devis' => $qty,
                        'prix_unitaire_ht' => round($globalHt / $qty, 4),
                        'tva_rate' => $documentTva,
                        'montant_ht' => $globalHt,
                    ]);
                } else {
                    foreach ($selectedJalons as $jalon) {
                        $this->createBcLigneFromJalon($bc, $jalon, $documentTva, $ordre++);
                    }
                }
            } else {
                foreach ($selectedJalons as $jalon) {
                    if (QuotePricingService::isJalonForfait($jalon)) {
                        $this->createBcLigneFromJalon($bc, $jalon, $documentTva, $ordre++);
                    }
                }
            }

            $meta = $quote->meta ?? [];
            if (! is_array($meta)) {
                $meta = [];
            }
            $meta['bon_commande_id'] = $bc->id;
            $existingIds = $meta['bon_commande_ids'] ?? [];
            if (! is_array($existingIds)) {
                $existingIds = [];
            }
            $meta['bon_commande_ids'] = array_values(array_unique([...$existingIds, $bc->id]));
            $meta['transforme_bc_at'] = now()->toIso8601String();
            $quote->update(['meta' => $meta]);

            $this->bonCommandeTotals->synchronize($bc);

            return $bc->load('lignes');
        });
    }

    /** Statuts de BC qu'une modification du devis peut encore compléter. */
    public const BC_SYNC_STATUTS = [
        BonCommande::STATUT_BROUILLON,
        BonCommande::STATUT_CONFIRME,
        BonCommande::STATUT_EN_COURS,
    ];

    /**
     * Répercute un devis modifié sur ses BC existants, sans jamais rien supprimer ni modifier :
     *  - détail (produit) ajouté à un jalon déjà présent sur un BC → nouvelle ligne sur ce BC,
     *    à la quantité du jalon sur ce BC et au prix du devis ;
     *  - ligne « Prestation forfaitaire » manquante d'un jalon forfait présent → ajoutée (prix du jalon) ;
     *  - jalon ou produit hors jalon *nouveau* (absent de $previousJalonIds / $previousRefIds) et
     *    présent sur aucun BC → ajouté au BC le plus récent encore modifiable.
     * Les jalons qui existaient déjà mais n'ont jamais été transférés (transfert partiel) ne sont pas
     * touchés : ils restent destinés à un futur BC.
     *
     * Avec $targetBc (action manuelle « compléter depuis le devis »), tout jalon/produit présent sur
     * aucun BC du devis est ajouté à ce BC.
     *
     * @param  list<string>|null  $previousJalonIds  ids des jalons avant la modification (null = inconnu)
     * @param  list<int>|null  $previousRefIds  ref_article_id des lignes avant la modification
     * @return int nombre de lignes ajoutées
     */
    public function syncBonsCommandeFromQuote(
        Quote $quote,
        ?array $previousJalonIds = null,
        ?array $previousRefIds = null,
        ?BonCommande $targetBc = null,
    ): int {
        $quote->loadMissing('quoteLines');
        $allBcs = BonCommande::query()->with('lignes')->where('quote_id', $quote->id)->orderByDesc('id')->get();
        $eligible = $allBcs->filter(fn (BonCommande $bc) => in_array($bc->statut, self::BC_SYNC_STATUTS, true))->values();
        if ($targetBc !== null) {
            $eligible = $eligible->where('id', $targetBc->id)->values();
        }
        if ($eligible->isEmpty()) {
            return 0;
        }
        $newTarget = $eligible->first();

        $meta = is_array($quote->meta) ? $quote->meta : [];
        if (QuotePricingService::isDocumentForfait($meta) && (float) ($meta['tarif_global_hors_lignes_ht'] ?? 0) > 0) {
            // Forfait global : une seule ligne de prix, la structure du BC ne suit pas les lignes du devis.
            return 0;
        }
        $documentTva = (float) $quote->tva_rate;
        $jalons = array_values(array_filter($meta['devis_jalons'] ?? [], 'is_array'));
        $quoteLineByRef = [];
        foreach ($quote->quoteLines as $ql) {
            $ref = (int) $ql->ref_article_id;
            if ($ref > 0) {
                $quoteLineByRef[$ref] ??= $ql;
            }
        }

        $bcHasRef = fn (BonCommande $bc, int $ref): bool => $bc->lignes->contains(fn ($l) => (int) $l->ref_article_id === $ref);
        $bcHasLibelle = fn (BonCommande $bc, string $libelle): bool => $bc->lignes->contains(fn ($l) => $l->libelle === $libelle);
        $added = 0;
        $touched = [];

        $addLine = function (BonCommande $bc, int $ref, float $qty) use ($quoteLineByRef, &$added, &$touched): void {
            $ql = $quoteLineByRef[$ref] ?? null;
            if ($ql === null) {
                return;
            }
            $pu = (float) $ql->unit_price;
            $ligne = BonCommandeLigne::query()->create([
                'bon_commande_id' => $bc->id,
                'ref_article_id' => $ref,
                'libelle' => $ql->description,
                'ordre' => ((int) $bc->lignes->max('ordre')) + 1,
                'quantite' => $qty,
                'quantite_devis' => $qty,
                'prix_unitaire_ht' => $pu,
                'tva_rate' => (float) $ql->tva_rate,
                'montant_ht' => round($qty * $pu, 2),
            ]);
            $bc->lignes->push($ligne);
            $added++;
            $touched[$bc->id] = $bc;
        };

        $jalonRefIds = [];
        foreach ($jalons as $idx => $jalon) {
            $jalonId = (string) ($jalon['id'] ?? 'idx-'.$idx);
            $label = trim((string) ($jalon['libelle'] ?? ''));
            $forfaitLibelle = $label !== '' ? 'Prestation forfaitaire — '.$label : 'Prestation forfaitaire';
            $isForfait = QuotePricingService::isJalonForfait($jalon);
            $refs = array_values(array_unique(array_filter(array_map('intval', (array) ($jalon['product_ref_article_ids'] ?? [])))));
            array_push($jalonRefIds, ...$refs);
            $quoteQty = max(1, (int) ($jalon['quantity'] ?? 1));

            $isOnBc = fn (BonCommande $bc): bool => ($isForfait && $bcHasLibelle($bc, $forfaitLibelle))
                || collect($refs)->contains(fn (int $ref) => $bcHasRef($bc, $ref));
            $presentOn = $allBcs->filter($isOnBc);

            if ($presentOn->isEmpty()) {
                $isNew = $targetBc !== null || ($previousJalonIds !== null && ! in_array($jalonId, $previousJalonIds, true));
                if (! $isNew) {
                    continue;
                }
                foreach ($refs as $ref) {
                    $ql = $quoteLineByRef[$ref] ?? null;
                    $addLine($newTarget, $ref, $isForfait ? (float) $quoteQty : (float) ($ql?->quantity ?? 1));
                }
                if ($isForfait) {
                    $this->createBcLigneFromJalon($newTarget, $jalon, $documentTva, ((int) $newTarget->lignes->max('ordre')) + 1);
                    $newTarget->load('lignes');
                    $added++;
                    $touched[$newTarget->id] = $newTarget;
                }

                continue;
            }

            foreach ($eligible->filter($isOnBc) as $bc) {
                $forfaitLigne = $bc->lignes->firstWhere('libelle', $forfaitLibelle);
                $firstChild = $bc->lignes->first(fn ($l) => in_array((int) $l->ref_article_id, $refs, true));
                $jalonQty = (float) ($forfaitLigne?->quantite ?? $firstChild?->quantite ?? $quoteQty);
                foreach ($refs as $ref) {
                    if (! $bcHasRef($bc, $ref)) {
                        $addLine($bc, $ref, $jalonQty);
                    }
                }
                if ($isForfait && $forfaitLigne === null) {
                    $this->createBcLigneFromJalon($bc, array_merge($jalon, ['quantity' => $jalonQty]), $documentTva, ((int) $bc->lignes->max('ordre')) + 1);
                    $bc->load('lignes');
                    $added++;
                    $touched[$bc->id] = $bc;
                }
            }
        }

        // Produits hors jalon : nouveaux sur le devis et présents sur aucun BC.
        $jalonRefIds = array_flip($jalonRefIds);
        foreach ($quoteLineByRef as $ref => $ql) {
            if (isset($jalonRefIds[$ref]) || $allBcs->contains(fn (BonCommande $bc) => $bcHasRef($bc, $ref))) {
                continue;
            }
            $isNew = $targetBc !== null || ($previousRefIds !== null && ! in_array($ref, $previousRefIds, true));
            if ($isNew) {
                $addLine($newTarget, $ref, (float) $ql->quantity);
            }
        }

        foreach ($touched as $bc) {
            $this->bonCommandeTotals->synchronize($bc->fresh());
        }

        return $added;
    }

    /**
     * Prix unitaire HT du devis pour une ligne de BC : par article (ref_article_id), par libellé,
     * ou — pour une ligne « Prestation forfaitaire — <jalon> » — prix du jalon. Null si introuvable.
     */
    public function quotePriceForBcLigne(Quote $quote, BonCommandeLigne $ligne): ?float
    {
        $quote->loadMissing('quoteLines');
        $ref = (int) $ligne->ref_article_id;
        $meta = is_array($quote->meta) ? $quote->meta : [];
        foreach ($meta['devis_jalons'] ?? [] as $jalon) {
            if (! is_array($jalon)) {
                continue;
            }
            $label = trim((string) ($jalon['libelle'] ?? ''));
            if ($label !== '' && $ligne->libelle === 'Prestation forfaitaire — '.$label) {
                $qty = max(1, (int) ($jalon['quantity'] ?? 1));

                return array_key_exists('prix_unitaire_ht', $jalon)
                    ? round(max(0.0, (float) $jalon['prix_unitaire_ht']), 4)
                    : round(QuotePricingService::forfaitJalonTotalHt($jalon) / $qty, 4);
            }
        }
        $ql = ($ref > 0 ? $quote->quoteLines->first(fn ($q) => (int) $q->ref_article_id === $ref) : null)
            ?? $quote->quoteLines->first(fn ($q) => $q->description === $ligne->libelle);

        return $ql !== null ? round((float) $ql->unit_price, 4) : null;
    }

    /** @param array<string, mixed> $jalon */
    private function createBcLigneFromJalon(BonCommande $bc, array $jalon, float $documentTva, int $ordre): void
    {
        $qty = max(1, (int) ($jalon['quantity'] ?? 1));
        $ht = QuotePricingService::forfaitJalonTotalHt($jalon);
        $pu = array_key_exists('prix_unitaire_ht', $jalon)
            ? round(max(0.0, (float) $jalon['prix_unitaire_ht']), 4)
            : ($qty > 0 ? round($ht / $qty, 4) : 0.0);
        $tva = isset($jalon['tva_rate']) ? (float) $jalon['tva_rate'] : $documentTva;
        $refId = isset($jalon['ref_article_id']) ? (int) $jalon['ref_article_id'] : 0;

        $libelle = isset($jalon['libelle']) && trim((string) $jalon['libelle']) !== ''
            ? 'Prestation forfaitaire — '.$jalon['libelle']
            : 'Prestation forfaitaire';

        BonCommandeLigne::query()->create([
            'bon_commande_id' => $bc->id,
            'ref_article_id' => $refId > 0 ? $refId : null,
            'libelle' => $libelle,
            'ordre' => $ordre,
            'quantite' => $qty,
            'quantite_devis' => $qty,
            'prix_unitaire_ht' => $pu,
            'tva_rate' => $tva,
            'montant_ht' => $ht,
        ]);
    }

    public function createBonLivraisonFromBonCommande(BonCommande $bc, User $user): BonLivraison
    {
        if (! in_array($bc->statut, [BonCommande::STATUT_CONFIRME, BonCommande::STATUT_EN_COURS, BonCommande::STATUT_LIVRE], true)) {
            throw new \InvalidArgumentException('Le bon de commande doit être confirmé (ou en cours) pour générer un BL.');
        }

        $bc->load('lignes');

        return DB::transaction(function () use ($bc, $user) {
            $bc->loadMissing('quote.site', 'dossier.site');
            $filialeCode = $bc->quote
                ? ClientFilialeResolver::codeForQuote($bc->quote)
                : ClientFilialeResolver::codeForSite($bc->dossier?->site);
            $numero = $this->sequences->next(DocumentSequence::TYPE_BON_LIVRAISON, $filialeCode);

            $bl = BonLivraison::query()->create([
                'numero' => $numero,
                'bon_commande_id' => $bc->id,
                'dossier_id' => $bc->dossier_id,
                'lab_centre_group_id' => $bc->lab_centre_group_id,
                'client_id' => $bc->client_id,
                'contact_id' => $bc->contact_id,
                'statut' => BonLivraison::STATUT_BROUILLON,
                'date_livraison' => now()->toDateString(),
                'notes' => null,
                'created_by' => $user->id,
            ]);

            foreach ($bc->lignes as $ligne) {
                BonLivraisonLigne::query()->create([
                    'bon_livraison_id' => $bl->id,
                    'bon_commande_ligne_id' => $ligne->id,
                    'ref_article_id' => $ligne->ref_article_id,
                    'libelle' => $ligne->libelle,
                    'quantite_livree' => 0,
                ]);
            }

            return $bl->load('lignes');
        });
    }
}
