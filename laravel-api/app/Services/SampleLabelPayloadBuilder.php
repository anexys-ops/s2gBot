<?php

namespace App\Services;

use App\Models\BonCommande;
use App\Models\BonCommandeLigne;
use App\Models\Sample;

/**
 * Données encodées dans le QR code et affichées sur l'étiquette FOLD.
 */
class SampleLabelPayloadBuilder
{
    public function __construct(
        private readonly DevisJalonResolver $jalonResolver,
    ) {}

    /** @return array<string, mixed> */
    public function build(Sample $sample): array
    {
        $sample->loadMissing([
            'dossier:id,reference,titre',
            'product:id,code,libelle',
            'collectedBy:id,name',
            'receivedBy:id,name',
        ]);
        // Rechargement explicite : l'appelant a pu charger ces relations avec des colonnes
        // réduites (sans ref_article_id / quote_id / ordre_mission_ligne_id) qui casseraient la
        // résolution du jalon.
        $sample->load([
            'bonCommandeLigne:id,bon_commande_id,ref_article_id,libelle',
            'bonCommandeLigne.bonCommande:id,numero,quote_id',
            'bonCommandeLigne.bonCommande.quote:id,number,meta',
            'bonCommandeLigne.bonCommande.lignes:id,bon_commande_id,libelle,prix_unitaire_ht',
            'task:id,ordre_mission_ligne_id',
            'task.ordreMissionLigne:id,libelle',
        ]);

        $bc = $sample->bonCommandeLigne?->bonCommande;
        $jalon = $this->resolveJalon($bc, $sample->bonCommandeLigne);
        $taskLabel = $sample->task?->ordreMissionLigne?->libelle
            ?? $sample->bonCommandeLigne?->libelle
            ?? $sample->product?->libelle;
        $receivedAt = $sample->received_at?->timezone(config('app.timezone'))->format('Y-m-d H:i:s');

        $payload = [
            'fold' => $sample->fold_number,
            'transco' => $sample->transco_number,
            'reception_index' => $sample->reception_index,
            'reception_batch_total' => $sample->reception_batch_total,
            'label_ref' => ($sample->reception_index && $sample->reception_batch_total)
                ? "{$sample->reception_index}/{$sample->reception_batch_total}"
                : null,
            'received_at' => $receivedAt,
            'received_by' => $sample->receivedBy?->name,
            'from' => $sample->collectedBy?->name,
            'product' => $sample->product?->libelle ?? $sample->bonCommandeLigne?->libelle,
            'product_code' => $sample->product?->code,
            'dossier' => $sample->dossier?->reference,
            'dossier_titre' => $sample->dossier?->titre,
            'bc' => $bc?->numero,
            'devis' => $bc?->quote?->number,
            'sample_type' => $sample->sample_type,
            'nature_echantillon' => $sample->nature_echantillon,
            'jalon' => $jalon['label'] ?? null,
            'jalon_prix_ht' => $jalon['prix_ht'] ?? null,
            'tache' => $taskLabel,
            'condition_state' => $sample->condition_state,
            'storage_location' => $sample->storage_location,
            'weight_g' => $sample->weight_g,
            'quantity' => $sample->quantity,
        ];

        $technicien = $sample->collectedBy?->name ?? $sample->receivedBy?->name;
        $prelevements = $sample->reception_batch_total ?? $sample->quantity ?? 1;

        // « fold » doit rester présent : le scanner labo s'en sert pour retrouver l'échantillon.
        $qrPayload = array_filter([
            'fold' => $sample->fold_number,
            'jalon' => $jalon['label'] ?? null,
            'tache' => $taskLabel,
            'dossier' => $sample->dossier?->reference,
            'prix_jalon_ht' => $jalon['prix_ht'] ?? null,
            'date' => $receivedAt,
            'technicien' => $technicien,
            'prelevements' => $prelevements,
        ], static fn ($value) => $value !== null && $value !== '');

        return [
            'payload' => $payload,
            'qr_json' => json_encode($qrPayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'barcode' => $sample->fold_number,
        ];
    }

    /**
     * Jalon du devis auquel appartient la ligne BC de l'échantillon, avec son prix unitaire HT :
     * celui de la ligne « Prestation forfaitaire — <jalon> » du BC (prix négocié), à défaut celui du devis.
     *
     * @return array{label: string, prix_ht: float|null}|null
     */
    private function resolveJalon(?BonCommande $bc, ?BonCommandeLigne $ligne): ?array
    {
        $match = $this->jalonResolver->jalonsForLigne($bc, $ligne)[0] ?? null;
        if ($match === null) {
            return null;
        }

        $label = trim(($match['code'] ? $match['code'].' — ' : '').$match['label']);
        $forfaitLibelle = 'Prestation forfaitaire — '.$match['label'];
        $forfaitLigne = $bc?->lignes->firstWhere('libelle', $forfaitLibelle);
        if ($forfaitLigne !== null) {
            return ['label' => $label, 'prix_ht' => round((float) $forfaitLigne->prix_unitaire_ht, 2)];
        }

        foreach ($bc?->quote?->meta['devis_jalons'] ?? [] as $jalon) {
            if ((string) ($jalon['id'] ?? '') !== $match['id']) {
                continue;
            }
            if (array_key_exists('prix_unitaire_ht', $jalon)) {
                return ['label' => $label, 'prix_ht' => round(max(0, (float) $jalon['prix_unitaire_ht']), 2)];
            }
            $qty = max(1, (float) ($jalon['quantity'] ?? 1));
            $total = QuotePricingService::forfaitJalonTotalHt($jalon);

            return ['label' => $label, 'prix_ht' => $total > 0 ? round($total / $qty, 2) : null];
        }

        return ['label' => $label, 'prix_ht' => null];
    }
}
