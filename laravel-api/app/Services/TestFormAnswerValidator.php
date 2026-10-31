<?php

namespace App\Services;

use App\Models\MissionTask;
use App\Models\TaskTestForm;
use Illuminate\Validation\ValidationException;

class TestFormAnswerValidator
{
    public function __construct(
        private readonly TaskFormAssignmentService $assignments,
        private readonly DynamicTestFormService $dynamicForms,
    ) {}

    /**
     * Une tâche ne peut être terminée que si chaque formulaire d'essai assigné
     * existe et que tous ses champs obligatoires sont renseignés.
     */
    public function assertTaskFormsComplete(MissionTask $task): void
    {
        $errors = [];
        $forms = $task->testForms()->get()->keyBy('test_type_id');
        foreach ($this->assignments->typesFor($task) as $testType) {
            $form = $forms->get($testType->id) ?? new TaskTestForm([
                'form_snapshot' => ['name' => $testType->name, 'norm' => $testType->norm,
                    'fields' => $this->dynamicForms->resolvedFields($testType->form_fields ?? [])],
                'answers' => [],
            ]);
            try {
                $this->validate($form, $form->answers ?? [], true);
            } catch (ValidationException) {
                $errors["statut"] = "Le formulaire « {$testType->name} » n'est pas entièrement renseigné : complétez les champs obligatoires avant de terminer la tâche.";
                break;
            }
        }
        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }

    public function validate(TaskTestForm $form, array $answers, bool $complete): void
    {
        $errors = [];
        $fields = collect($form->form_snapshot['fields'] ?? []);
        $keys = $fields->pluck('key')->all();
        foreach (array_keys($answers) as $key) {
            if (! in_array($key, $keys, true)) {
                $errors["answers.$key"] = 'Champ non prévu dans le formulaire.';
            }
        }
        foreach ($fields as $field) {
            $key = $field['key'];
            $value = $answers[$key] ?? null;
            if ($field['type'] === 'photo') {
                if ($complete && ($field['required'] ?? false) && ! $form->photos()->where('field_key', $key)->exists()) {
                    $errors["answers.$key"] = 'Photo requise.';
                }
                continue;
            }
            if ($field['type'] === 'table') {
                if ($value === null && ! ($complete && ($field['required'] ?? false))) {
                    continue;
                }
                if (! is_array($value) || ! array_is_list($value)) {
                    $errors["answers.$key"] = 'Le tableau doit contenir des lignes.';
                    continue;
                }
                if ($complete && ($field['required'] ?? false) && $value === []) {
                    $errors["answers.$key"] = 'Ajoutez au moins une ligne.';
                }
                foreach ($value as $rowIndex => $row) {
                    if (! is_array($row)) {
                        $errors["answers.$key.$rowIndex"] = 'Ligne invalide.';
                        continue;
                    }
                    $columnKeys = array_column($field['columns'] ?? [], 'key');
                    foreach (array_keys($row) as $columnKey) {
                        if (! in_array($columnKey, $columnKeys, true)) $errors["answers.$key.$rowIndex.$columnKey"] = 'Colonne inconnue.';
                    }
                    foreach ($field['columns'] ?? [] as $column) {
                        $columnKey = $column['key'];
                        $error = $this->valueError($column, $row[$columnKey] ?? null, $complete);
                        if ($error) $errors["answers.$key.$rowIndex.$columnKey"] = $error;
                    }
                }
                continue;
            }
            $error = $this->valueError($field, $value, $complete);
            if ($error) $errors["answers.$key"] = $error;
        }
        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }

    private function valueError(array $field, mixed $value, bool $complete): ?string
    {
        if ($value === null || $value === '' || $value === []) {
            return $complete && ($field['required'] ?? false) ? 'Champ requis.' : null;
        }
        $valid = match ($field['type']) {
            'number', 'formula' => is_numeric($value),
            'boolean' => is_bool($value),
            'date' => is_string($value) && (bool) preg_match('/^\d{4}-\d{2}-\d{2}$/', $value),
            'time' => is_string($value) && (bool) preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $value),
            'duration' => is_string($value) && (bool) preg_match('/^\d{1,3}:[0-5]\d$/', $value),
            'select' => is_string($value) && in_array($value, $field['options'] ?? [], true),
            'checkboxes' => is_array($value) && array_is_list($value)
                && count($value) === count(array_unique($value))
                && collect($value)->every(fn ($item) => is_string($item) && in_array($item, $field['options'] ?? [], true)),
            default => is_string($value),
        };
        return $valid ? null : 'Valeur invalide.';
    }
}
