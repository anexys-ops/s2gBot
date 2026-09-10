<?php

namespace App\Services;

use App\Models\DocumentSequence;
use Illuminate\Support\Facades\DB;

class DocumentSequenceService
{
    /**
     * Génère la prochaine référence unique du type (format PREFIX-YYYY-NNNN/TRIGRAMME).
     */
    public function next(string $type, ?string $agencyCode = null, ?int $year = null): string
    {
        $year = $year ?? (int) now()->format('Y');
        $prefix = $this->prefixFor($type);
        $agencyCode = $this->normalizeAgencyCode($agencyCode);

        return DB::transaction(function () use ($type, $year, $prefix, $agencyCode) {
            $row = DocumentSequence::query()
                ->where('type', $type)
                ->where('year', $year)
                ->where('agency_code', $agencyCode)
                ->lockForUpdate()
                ->first();

            if (! $row) {
                $row = DocumentSequence::query()->create([
                    'type' => $type,
                    'year' => $year,
                    'agency_code' => $agencyCode,
                    'last_number' => 0,
                ]);
            }

            $row->last_number = (int) $row->last_number + 1;
            $row->save();

            return sprintf('%s-%d-%04d/%s', $prefix, $year, $row->last_number, $agencyCode);
        });
    }

    public function normalizeAgencyCode(?string $agencyCode): string
    {
        $normalized = strtoupper(trim((string) $agencyCode));

        return $normalized !== '' ? $normalized : 'HQ';
    }

    public function prefixFor(string $type): string
    {
        return match ($type) {
            DocumentSequence::TYPE_DOSSIER => 'DOS',
            DocumentSequence::TYPE_DEVIS => 'DEV',
            DocumentSequence::TYPE_BON_COMMANDE => 'BCC',
            DocumentSequence::TYPE_BON_LIVRAISON => 'BLC',
            DocumentSequence::TYPE_FACTURE => 'FAC',
            DocumentSequence::TYPE_ORDRE_MISSION => 'OM',
            DocumentSequence::TYPE_REGLEMENT => 'REG',
            DocumentSequence::TYPE_SITUATION => 'SIT',
            DocumentSequence::TYPE_AVOIR => 'AVO',
            default => strtoupper(substr($type, 0, 3)),
        };
    }
}
