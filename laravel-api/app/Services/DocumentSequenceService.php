<?php

namespace App\Services;

use App\Models\DocumentSequence;
use Illuminate\Support\Facades\DB;

class DocumentSequenceService
{
    /**
     * Génère la prochaine référence unique du type (format PREFIX-YYYY-NNNN).
     */
    public function next(string $type, ?int $year = null): string
    {
        $year = $year ?? (int) now()->format('Y');
        $prefix = $this->prefixFor($type);

        return DB::transaction(function () use ($type, $year, $prefix) {
            $row = DocumentSequence::query()
                ->where('type', $type)
                ->where('year', $year)
                ->lockForUpdate()
                ->first();

            if (! $row) {
                $row = DocumentSequence::query()->create([
                    'type' => $type,
                    'year' => $year,
                    'last_number' => 0,
                ]);
            }

            $row->last_number = (int) $row->last_number + 1;
            $row->save();

            return sprintf('%s-%d-%04d', $prefix, $year, $row->last_number);
        });
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
