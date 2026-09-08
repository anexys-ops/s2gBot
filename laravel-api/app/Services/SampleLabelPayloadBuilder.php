<?php

namespace App\Services;

use App\Models\Sample;

/**
 * Données encodées dans le QR code et affichées sur l'étiquette FOLD.
 */
class SampleLabelPayloadBuilder
{
    /** @return array<string, mixed> */
    public function build(Sample $sample): array
    {
        $sample->loadMissing([
            'dossier:id,reference,titre',
            'product:id,code,libelle',
            'bonCommandeLigne.bonCommande:id,numero,quote_id',
            'bonCommandeLigne.bonCommande.quote:id,number',
            'collectedBy:id,name',
            'receivedBy:id,name',
        ]);

        $bc = $sample->bonCommandeLigne?->bonCommande;
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
            'condition_state' => $sample->condition_state,
            'storage_location' => $sample->storage_location,
            'weight_g' => $sample->weight_g,
            'quantity' => $sample->quantity,
        ];

        // QR compact (FOLD ou transco) — compatible scanners téléphone / douchette.
        // L'ancien format JSON complet reste lisible via parseSampleQrContent côté front.
        $qrValue = $sample->fold_number ?: $sample->transco_number;

        return [
            'payload' => $payload,
            'qr_json' => $qrValue,
            'barcode' => $sample->transco_number,
        ];
    }
}
