<?php

namespace App\Services;

use App\Models\ExtrafieldDefinition;
use App\Models\ExtrafieldValue;
use Illuminate\Support\Str;
use InvalidArgumentException;

class ExtrafieldSyncService
{
    /**
     * @param  array<string, mixed>  $valuesByCode
     * @return array<int, string|null> definition_id => normalized string value
     */
    public function validateAndNormalize(string $entityType, int $entityId, array $valuesByCode): array
    {
        if (! in_array($entityType, ExtrafieldDefinition::entityTypes(), true)) {
            throw new InvalidArgumentException('Type d\'entité inconnu.');
        }

        $definitions = ExtrafieldDefinition::query()
            ->where('entity_type', $entityType)
            ->get()
            ->keyBy('code');

        $normalized = [];

        foreach ($definitions as $code => $def) {
            $raw = $valuesByCode[$code] ?? null;
            if ($def->required && ($raw === null || $raw === '')) {
                throw new InvalidArgumentException('Champ obligatoire manquant : '.$def->label.' ('.$code.').');
            }
            if ($raw === null || $raw === '') {
                $normalized[$def->id] = null;

                continue;
            }
            $normalized[$def->id] = $this->normalizeValue($def, $raw);
        }

        foreach (array_keys($valuesByCode) as $code) {
            if (! $definitions->has($code)) {
                throw new InvalidArgumentException('Champ inconnu pour ce module : '.$code);
            }
        }

        return $normalized;
    }

    public function sync(string $entityType, int $entityId, array $valuesByCode): void
    {
        $normalized = $this->validateAndNormalize($entityType, $entityId, $valuesByCode);

        foreach ($normalized as $definitionId => $value) {
            if ($value === null || $value === '') {
                ExtrafieldValue::query()
                    ->where('extrafield_definition_id', $definitionId)
                    ->where('entity_id', $entityId)
                    ->delete();
            } else {
                ExtrafieldValue::query()->updateOrCreate(
                    [
                        'extrafield_definition_id' => $definitionId,
                        'entity_id' => $entityId,
                    ],
                    ['value' => $value]
                );
            }
        }
    }

    private function normalizeValue(ExtrafieldDefinition $def, mixed $raw): string
    {
        return match ($def->field_type) {
            'text', 'textarea' => (string) $raw,
            'number' => $this->normalizeNumber($raw),
            'date' => $this->normalizeDate($raw),
            'boolean' => $this->normalizeBool($raw) ? '1' : '0',
            'select' => $this->normalizeSelect($def, $raw),
            default => throw new InvalidArgumentException('Type de champ non géré : '.$def->field_type),
        };
    }

    private function normalizeNumber(mixed $raw): string
    {
        if (! is_numeric($raw)) {
            throw new InvalidArgumentException('Valeur numérique attendue.');
        }

        return (string) $raw;
    }

    private function normalizeDate(mixed $raw): string
    {
        $s = (string) $raw;
        if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $s)) {
            throw new InvalidArgumentException('Date attendue au format YYYY-MM-DD.');
        }

        return $s;
    }

    private function normalizeBool(mixed $raw): bool
    {
        if (is_bool($raw)) {
            return $raw;
        }
        $s = Str::lower(trim((string) $raw));

        return in_array($s, ['1', 'true', 'oui', 'yes', 'on'], true);
    }

    private function normalizeSelect(ExtrafieldDefinition $def, mixed $raw): string
    {
        $options = $def->select_options ?? [];
        $allowed = [];
        foreach ($options as $opt) {
            if (is_array($opt) && isset($opt['value'])) {
                $allowed[] = (string) $opt['value'];
            }
        }
        $v = (string) $raw;
        if ($allowed !== [] && ! in_array($v, $allowed, true)) {
            throw new InvalidArgumentException('Valeur non proposée pour le champ : '.$def->label);
        }

        return $v;
    }
}
