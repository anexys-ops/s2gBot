<?php

namespace App\Services;

use App\Models\BonCommande;
use App\Models\BonCommandeLigne;
use App\Models\BonLivraison;
use App\Models\BonLivraisonLigne;
use App\Models\DocumentSequence;
use App\Models\Quote;
use App\Models\QuoteLine;
use App\Models\User;
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

        if (BonCommande::query()->where('quote_id', $quote->id)->exists()) {
            throw new \InvalidArgumentException('Un bon de commande existe déjà pour ce devis.');
        }

        if (! in_array($quote->status, [Quote::STATUS_SIGNED, Quote::STATUS_ACCEPTED], true)) {
            throw new \InvalidArgumentException('Le devis doit être accepté (signé ou accepté) pour générer un BC.');
        }

        $quote->load('quoteLines');

        return DB::transaction(function () use ($quote, $user) {
            $numero = $this->sequences->next(DocumentSequence::TYPE_BON_COMMANDE);

            $bc = BonCommande::query()->create([
                'numero' => $numero,
                'quote_id' => $quote->id,
                'dossier_id' => $quote->dossier_id,
                'client_id' => $quote->client_id,
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
            /** @var QuoteLine $line */
            foreach ($quote->quoteLines as $line) {
                $ht = (float) $line->total;
                BonCommandeLigne::query()->create([
                    'bon_commande_id' => $bc->id,
                    'ref_article_id' => $line->ref_article_id,
                    'libelle' => $line->description,
                    'ordre' => $ordre++,
                    'quantite' => (float) $line->quantity,
                    'prix_unitaire_ht' => (float) $line->unit_price,
                    'tva_rate' => (float) $line->tva_rate,
                    'montant_ht' => $ht,
                ]);
            }

            $meta = $quote->meta ?? [];
            if (! is_array($meta)) {
                $meta = [];
            }
            $meta['bon_commande_id'] = $bc->id;
            $meta['transforme_bc_at'] = now()->toIso8601String();
            $quote->update(['meta' => $meta]);

            return $bc->load('lignes');
        });
    }

    public function createBonLivraisonFromBonCommande(BonCommande $bc, User $user): BonLivraison
    {
        if (! in_array($bc->statut, [BonCommande::STATUT_CONFIRME, BonCommande::STATUT_EN_COURS, BonCommande::STATUT_LIVRE], true)) {
            throw new \InvalidArgumentException('Le bon de commande doit être confirmé (ou en cours) pour générer un BL.');
        }

        $bc->load('lignes');

        return DB::transaction(function () use ($bc, $user) {
            $numero = $this->sequences->next(DocumentSequence::TYPE_BON_LIVRAISON);

            $bl = BonLivraison::query()->create([
                'numero' => $numero,
                'bon_commande_id' => $bc->id,
                'dossier_id' => $bc->dossier_id,
                'client_id' => $bc->client_id,
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
