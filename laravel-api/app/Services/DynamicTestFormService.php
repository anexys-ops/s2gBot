<?php

namespace App\Services;

use App\Models\FormOptionList;
use Illuminate\Validation\ValidationException;

class DynamicTestFormService
{
    public function resolvedFields(array $fields): array
    {
        return array_map(function (array $field) {
            if (in_array($field['type'] ?? null, ['select', 'checkboxes'], true) && ! empty($field['list_id'])) {
                $field['options'] = FormOptionList::query()->find($field['list_id'])?->options ?? [];
            }
            if (($field['type'] ?? null) === 'table') {
                $field['columns'] = $this->resolvedFields($field['columns'] ?? []);
            }
            return $field;
        }, $fields);
    }

    public function validateSchema(array $fields): void
    {
        $known = [];
        foreach ($fields as $index => $field) {
            $key = $field['key'];
            if (in_array($field['type'], ['select', 'checkboxes'], true) && empty($field['options']) && empty($field['list_id'])) {
                throw ValidationException::withMessages(["form_fields.$index.options" => 'Ajoutez des choix ou sélectionnez une liste commune.']);
            }
            if ($field['type'] === 'formula') {
                $this->assertFormula($field['formula'] ?? '', $known, "form_fields.$index.formula");
            }
            if ($field['type'] === 'table') {
                if (empty($field['columns'])) {
                    throw ValidationException::withMessages(["form_fields.$index.columns" => 'Ajoutez au moins une colonne au tableau.']);
                }
                $columns = [];
                foreach ($field['columns'] as $columnIndex => $column) {
                    if ($column['type'] === 'select' && empty($column['options']) && empty($column['list_id'])) {
                        throw ValidationException::withMessages(["form_fields.$index.columns.$columnIndex.options" => 'Ajoutez des choix ou une liste commune.']);
                    }
                    if ($column['type'] === 'formula') {
                        $this->assertFormula($column['formula'] ?? '', $columns, "form_fields.$index.columns.$columnIndex.formula");
                    }
                    $columns[$column['key']] = $column['type'];
                }
            }
            $known[$key] = $field['type'];
        }
    }

    private function assertFormula(string $formula, array $known, string $path): void
    {
        if ($formula === '' || strlen($formula) > 255) {
            throw ValidationException::withMessages([$path => 'Saisissez une formule de 255 caractères maximum.']);
        }
        $tokens = $this->tokens($formula);
        foreach ($tokens as $token) {
            if (preg_match('/^[a-z][a-z0-9_]*$/i', $token) && ($known[$token] ?? null) !== 'number' && ($known[$token] ?? null) !== 'formula') {
                throw ValidationException::withMessages([$path => 'La formule ne peut utiliser que les champs numériques précédents.']);
            }
        }
        $values = array_fill_keys(array_keys($known), 1);
        $this->calculate($formula, $values, true);
    }

    public function calculateAnswers(array $fields, array $answers): array
    {
        $values = [];
        foreach ($fields as $field) {
            $key = $field['key'];
            if ($field['type'] === 'formula') {
                $answers[$key] = $this->calculate($field['formula'], $values);
            } elseif ($field['type'] === 'table' && is_array($answers[$key] ?? null)) {
                foreach ($answers[$key] as $index => $row) {
                    if (! is_array($row)) continue;
                    $rowValues = [];
                    foreach ($field['columns'] ?? [] as $column) {
                        $columnKey = $column['key'];
                        if ($column['type'] === 'formula') {
                            $row[$columnKey] = $this->calculate($column['formula'], $rowValues);
                        }
                        $rowValues[$columnKey] = $row[$columnKey] ?? null;
                    }
                    $answers[$key][$index] = $row;
                }
            }
            $values[$key] = $answers[$key] ?? null;
        }
        return $answers;
    }

    public function calculate(string $expression, array $values, bool $checkingSyntax = false): ?float
    {
        $tokens = $this->tokens($expression);
        $position = 0;
        $parseExpression = null;
        $parseFactor = function () use (&$parseExpression, &$parseFactor, &$position, $tokens, $values): ?float {
            $token = $tokens[$position] ?? null;
            if ($token === '-') {
                $position++;
                $value = $parseFactor();
                return $value === null ? null : -$value;
            }
            if ($token === '(') {
                $position++;
                $value = $parseExpression();
                if (($tokens[$position++] ?? null) !== ')') $this->invalidFormula();
                return $value;
            }
            if ($token === null || in_array($token, [')', '+', '*', '/'], true)) $this->invalidFormula();
            $position++;
            if (is_numeric($token)) return (float) $token;
            $value = $values[$token] ?? null;
            return is_numeric($value) ? (float) $value : null;
        };
        $parseTerm = function () use (&$parseFactor, &$position, $tokens, $checkingSyntax): ?float {
            $value = $parseFactor();
            while (in_array($tokens[$position] ?? null, ['*', '/'], true)) {
                $operator = $tokens[$position++];
                $right = $parseFactor();
                if ($value === null || $right === null) { $value = null; continue; }
                if ($operator === '/' && $right == 0.0) {
                    if ($checkingSyntax) { $value = 1.0; continue; }
                    throw ValidationException::withMessages(['answers' => 'Division par zéro dans la formule.']);
                }
                $value = $operator === '*' ? $value * $right : $value / $right;
            }
            return $value;
        };
        $parseExpression = function () use (&$parseExpression, &$parseTerm, &$position, $tokens): ?float {
            $value = $parseTerm();
            while (in_array($tokens[$position] ?? null, ['+', '-'], true)) {
                $operator = $tokens[$position++];
                $right = $parseTerm();
                $value = $value === null || $right === null ? null : ($operator === '+' ? $value + $right : $value - $right);
            }
            return $value;
        };
        $result = $parseExpression();
        if ($position !== count($tokens)) $this->invalidFormula();
        return $result === null ? null : round($result, 6);
    }

    private function tokens(string $expression): array
    {
        preg_match_all('/\s*(\d+(?:\.\d+)?|[a-z][a-z0-9_]*|[()+*\/-])\s*/i', $expression, $matches);
        if ($matches[0] === [] || implode('', $matches[0]) !== $expression) $this->invalidFormula();
        return $matches[1];
    }

    private function invalidFormula(): never
    {
        throw ValidationException::withMessages(['formula' => 'Formule invalide. Utilisez les clés numériques, +, -, *, / et les parenthèses.']);
    }
}
