<?php

namespace App\Support;

use Carbon\Carbon;

class ActivityChangeTracker
{
    /** @var list<string> */
    private const DATE_FIELDS = [
        'quote_date', 'invoice_date', 'valid_until', 'order_date',
        'site_delivery_date', 'due_date', 'next_reminder_date',
    ];

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
            $old = self::normalizeValue($key, $before[$key] ?? null);
            $new = self::normalizeValue($key, $after[$key] ?? null);
            if ($old != $new) {
                $changes[$key] = [
                    'from' => self::formatValue($key, $before[$key] ?? null),
                    'to' => self::formatValue($key, $after[$key] ?? null),
                ];
            }
        }

        return $changes;
    }

    /**
     * Compare les lignes d’un document commercial (devis, facture…) par position.
     *
     * @param  list<array<string, mixed>>  $before
     * @param  list<array<string, mixed>>  $after
     * @return list<array<string, mixed>>
     */
    public static function diffDocumentLines(array $before, array $after): array
    {
        $changes = [];
        $max = max(count($before), count($after));
        $fields = ['description', 'quantity', 'unit_price', 'unite', 'total', 'tva_rate', 'discount_percent'];

        for ($i = 0; $i < $max; $i++) {
            $lineNum = $i + 1;
            $b = $before[$i] ?? null;
            $a = $after[$i] ?? null;

            if ($b === null && $a !== null) {
                $changes[] = [
                    'line' => $lineNum,
                    'action' => 'added',
                    'description' => (string) ($a['description'] ?? ''),
                    'to' => self::summarizeLine($a),
                ];
                continue;
            }

            if ($a === null && $b !== null) {
                $changes[] = [
                    'line' => $lineNum,
                    'action' => 'removed',
                    'description' => (string) ($b['description'] ?? ''),
                    'from' => self::summarizeLine($b),
                ];
                continue;
            }

            if ($b === null || $a === null) {
                continue;
            }

            $desc = (string) ($a['description'] ?: $b['description'] ?: "Ligne {$lineNum}");
            foreach ($fields as $field) {
                $old = self::normalizeLineValue($field, $b[$field] ?? null);
                $new = self::normalizeLineValue($field, $a[$field] ?? null);
                if ($old != $new) {
                    $changes[] = [
                        'line' => $lineNum,
                        'description' => $desc,
                        'field' => $field,
                        'from' => self::formatLineValue($field, $b[$field] ?? null),
                        'to' => self::formatLineValue($field, $a[$field] ?? null),
                    ];
                }
            }
        }

        return $changes;
    }

    /**
     * @param  array<string, array{from: mixed, to: mixed}>  $fieldChanges
     * @param  list<array<string, mixed>>  $lineChanges
     */
    public static function buildDetailSummary(array $fieldChanges, array $lineChanges = []): string
    {
        $parts = [];

        foreach ($lineChanges as $row) {
            $action = $row['action'] ?? null;
            $line = (int) ($row['line'] ?? 0);
            $desc = mb_substr((string) ($row['description'] ?? ''), 0, 60);

            if ($action === 'added') {
                $parts[] = "Ligne {$line} ajoutée : {$desc}";
                continue;
            }
            if ($action === 'removed') {
                $parts[] = "Ligne {$line} supprimée : {$desc}";
                continue;
            }

            $fieldLabel = self::fieldLabel((string) ($row['field'] ?? ''));
            $parts[] = "Ligne {$line} ({$desc}) — {$fieldLabel} : {$row['from']} → {$row['to']}";
        }

        foreach ($fieldChanges as $field => $diff) {
            if (in_array($field, ['amount_ht', 'amount_ttc'], true) && $lineChanges !== []) {
                continue;
            }
            $parts[] = self::fieldLabel($field).' : '.$diff['from'].' → '.$diff['to'];
        }

        return implode(' · ', array_slice($parts, 0, 8));
    }

    public static function fieldLabel(string $field): string
    {
        return match ($field) {
            'status' => 'Statut',
            'notes' => 'Notes',
            'number' => 'Numéro',
            'name' => 'Nom',
            'email' => 'E-mail',
            'phone' => 'Téléphone',
            'amount_ht' => 'Montant HT',
            'amount_ttc' => 'Montant TTC',
            'client_id' => 'Client',
            'contact_id' => 'Contact',
            'site_id' => 'Chantier',
            'dossier_id' => 'Dossier',
            'quote_date' => 'Date devis',
            'invoice_date' => 'Date facture',
            'valid_until' => 'Validité',
            'discount_percent' => 'Remise %',
            'discount_amount' => 'Remise €',
            'description' => 'Description',
            'quantity' => 'Quantité',
            'unit_price' => 'Prix unitaire',
            'unite' => 'Unité',
            'total' => 'Total ligne',
            'tva_rate' => 'TVA',
            default => $field,
        };
    }

    private static function normalizeValue(string $key, mixed $value): mixed
    {
        if (in_array($key, self::DATE_FIELDS, true)) {
            return self::normalizeDate($value);
        }

        return $value;
    }

    private static function formatValue(string $key, mixed $value): mixed
    {
        if (in_array($key, self::DATE_FIELDS, true)) {
            return self::formatDate($value);
        }

        return $value;
    }

    private static function normalizeLineValue(string $field, mixed $value): mixed
    {
        if (in_array($field, ['unit_price', 'total', 'tva_rate', 'discount_percent'], true)) {
            return $value === null ? null : round((float) $value, 2);
        }

        return $value;
    }

    private static function formatLineValue(string $field, mixed $value): mixed
    {
        if (in_array($field, ['unit_price', 'total', 'tva_rate', 'discount_percent'], true)) {
            return $value === null ? null : number_format((float) $value, 2, ',', ' ');
        }

        return $value;
    }

    /**
     * @param  array<string, mixed>  $line
     */
    private static function summarizeLine(array $line): string
    {
        $qty = $line['quantity'] ?? '?';
        $price = isset($line['unit_price']) ? number_format((float) $line['unit_price'], 2, ',', ' ') : '?';

        return "{$qty} × {$price} €";
    }

    private static function normalizeDate(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        try {
            return Carbon::parse((string) $value)->toDateString();
        } catch (\Throwable) {
            return (string) $value;
        }
    }

    private static function formatDate(mixed $value): ?string
    {
        $normalized = self::normalizeDate($value);
        if ($normalized === null) {
            return null;
        }

        try {
            return Carbon::parse($normalized)->format('d/m/Y');
        } catch (\Throwable) {
            return $normalized;
        }
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
