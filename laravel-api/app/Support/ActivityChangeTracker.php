<?php

namespace App\Support;

class ActivityChangeTracker
{
    /**
     * @param  array<string, mixed>  $before
     * @param  array<string, mixed>  $after
     * @param  list<string>  $ignore
     * @return array<string, array{from: mixed, to: mixed}>
     */
    public static function diff(array $before, array $after, array $ignore = ['updated_at', 'created_at']): array
    {
        $changes = [];
        $keys = array_unique(array_merge(array_keys($before), array_keys($after)));

        foreach ($keys as $key) {
            if (in_array($key, $ignore, true)) {
                continue;
            }
            $old = $before[$key] ?? null;
            $new = $after[$key] ?? null;
            if ($old != $new) {
                $changes[$key] = ['from' => $old, 'to' => $new];
            }
        }

        return $changes;
    }

    /**
     * @param  array<string, array{from: mixed, to: mixed}>  $changes
     */
    public static function summarizeFieldChanges(array $changes, int $maxFields = 6): string
    {
        if ($changes === []) {
            return '';
        }

        $labels = [
            'status' => 'statut',
            'notes' => 'notes',
            'number' => 'numéro',
            'name' => 'nom',
            'email' => 'e-mail',
            'phone' => 'téléphone',
            'amount_ht' => 'montant HT',
            'amount_ttc' => 'montant TTC',
            'client_id' => 'client',
            'contact_id' => 'contact',
            'site_id' => 'chantier',
            'dossier_id' => 'dossier',
            'quote_date' => 'date devis',
            'invoice_date' => 'date facture',
            'valid_until' => 'validité',
            'discount_percent' => 'remise %',
            'discount_amount' => 'remise €',
            'portal_modules' => 'modules portail',
        ];

        $parts = [];
        foreach (array_slice(array_keys($changes), 0, $maxFields) as $field) {
            $parts[] = $labels[$field] ?? $field;
        }

        $extra = count($changes) - count($parts);
        $summary = implode(', ', $parts);

        return $extra > 0 ? $summary.' +'.$extra : $summary;
    }

    /**
     * @param  list<string>  $tasks
     */
    public static function buildDescription(
        string $entityType,
        int $entityId,
        ?string $reference,
        string $verb,
        ?string $clientName = null,
        array $tasks = [],
        ?string $fieldSummary = null,
    ): string {
        $ref = $reference ? " ({$reference})" : '';
        $parts = ["{$entityType} #{$entityId}{$ref} — {$verb}"];

        if ($tasks !== []) {
            $parts[] = implode(', ', $tasks);
        }
        if ($fieldSummary !== null && $fieldSummary !== '') {
            $parts[] = $fieldSummary;
        }
        if ($clientName !== null && $clientName !== '') {
            $parts[] = "Client: {$clientName}";
        }

        return implode(' | ', $parts);
    }
}
