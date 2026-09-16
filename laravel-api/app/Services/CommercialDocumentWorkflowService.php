<?php

namespace App\Services;

use App\Models\BonCommande;
use App\Models\BonCommandeLigne;
use App\Models\BonLivraison;
use App\Models\BonLivraisonLigne;
use App\Models\Dossier;
use App\Models\DocumentSequence;
use App\Models\Quote;
use App\Models\QuoteLine;
use App\Models\User;
use App\Support\ClientFilialeResolver;
use Illuminate\Support\Facades\DB;

class CommercialDocumentWorkflowService
{
    public function __construct(
        private readonly DocumentSequenceService $sequences
    ) {}

    public function createBonCommandeFromQuote(Quote $quote, User $user): BonCommande
    {
        if (! $quote->dossier_id) {
            throw new \InvalidArgumentException('Devis sans dossier : impossible de créer un bon de commande.');
        }

        if (! in_array($quote->status, [Quote::STATUS_SIGNED, Quote::STATUS_ACCEPTED], true)) {
            throw new \InvalidArgumentException('Le devis doit être accepté (signé ou accepté) pour générer un BC.');
        }

        $quote->load('quoteLines');

        return DB::transaction(function () use ($quote, $user) {
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

            if (QuotePricingService::isDocumentForfait($quoteMeta)) {
                $globalHt = round(max(0.0, (float) ($quoteMeta['tarif_global_hors_lignes_ht'] ?? 0)), 2);
                if ($globalHt > 0) {
                    $qty = max(1, (int) ($quoteMeta['tarif_global_quantity'] ?? 1));
                    $pu = round($globalHt / $qty, 4);
                    BonCommandeLigne::query()->create([
                        'bon_commande_id' => $bc->id,
                        'ref_article_id' => null,
                        'libelle' => $quoteMeta['tarif_global_designation'] ?? 'Prestation forfaitaire',
                        'ordre' => $ordre++,
                        'quantite' => $qty,
                        'quantite_devis' => $qty,
                        'prix_unitaire_ht' => $pu,
                        'tva_rate' => $documentTva,
                        'montant_ht' => $globalHt,
                    ]);
                } else {
                    foreach ($quoteMeta['devis_jalons'] ?? [] as $jalon) {
                        if (is_array($jalon)) {
                            $this->createBcLigneFromJalon($bc, $jalon, $documentTva, $ordre++);
                        }
                    }
                }
            } else {
                $forfaitRefIds = [];
                $forfaitJalons = [];
                foreach ($quoteMeta['devis_jalons'] ?? [] as $jalon) {
                    if (! is_array($jalon) || ! QuotePricingService::isJalonForfait($jalon)) {
                        continue;
                    }
                    $forfaitJalons[] = $jalon;
                    foreach ($jalon['product_ref_article_ids'] ?? [] as $refId) {
                        $id = (int) $refId;
                        if ($id > 0) {
                            $forfaitRefIds[$id] = true;
                        }
                    }
                }

                /** @var QuoteLine $line */
                foreach ($quote->quoteLines as $line) {
                    $refId = (int) ($line->ref_article_id ?? 0);
                    if ($refId > 0 && isset($forfaitRefIds[$refId])) {
                        continue;
                    }
                    BonCommandeLigne::query()->create([
                        'bon_commande_id' => $bc->id,
                        'ref_article_id' => $line->ref_article_id,
                        'libelle' => $line->description,
                        'ordre' => $ordre++,
                        'quantite' => (float) $line->quantity,
                        'quantite_devis' => (float) $line->quantity,
                        'prix_unitaire_ht' => (float) $line->unit_price,
                        'tva_rate' => (float) $line->tva_rate,
                        'montant_ht' => (float) $line->total,
                    ]);
                }

                foreach ($forfaitJalons as $jalon) {
                    $this->createBcLigneFromJalon($bc, $jalon, $documentTva, $ordre++);
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

            return $bc->load('lignes');
        });
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
