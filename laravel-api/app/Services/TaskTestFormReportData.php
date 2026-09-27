<?php

namespace App\Services;

use App\Models\TaskTestForm;

class TaskTestFormReportData
{
    /**
     * Normalise les réponses d'un TaskTestForm pour l'export (Word/Excel).
     * Contrairement à TaskMeasurementsPdfGenerator (qui aplati tout en texte pour
     * un rendu PDF compact), les champs "table" gardent ici leurs lignes/colonnes
     * structurées — nécessaire pour produire de vrais tableaux Word/Excel
     * exploitables (ex. suivi d'un essai sur plusieurs échéances/jours).
     */
    public static function build(TaskTestForm $form): array
    {
        $form->loadMissing([
            'testType:id,name,norm,description',
            'photos',
            'missionTask.assignedUser:id,name',
            'missionTask.ordreMissionLigne.ordreMission.client:id,name',
            'missionTask.ordreMissionLigne.ordreMission.site:id,name',
            'missionTask.ordreMissionLigne.ordreMission.dossier:id,reference,titre',
        ]);

        $fields = $form->form_snapshot['fields'] ?? [];
        $answers = $form->answers ?? [];

        $scalarRows = [];
        $tableSections = [];

        foreach ($fields as $field) {
            $type = $field['type'] ?? 'text';
            $value = $answers[$field['key']] ?? null;

            if ($type === 'table') {
                $tableSections[] = [
                    'label' => $field['label'] ?? $field['key'],
                    'columns' => $field['columns'] ?? [],
                    'rows' => is_array($value) ? $value : [],
                ];
                continue;
            }
            if ($type === 'photo') {
                continue;
            }

            $display = match (true) {
                is_bool($value) => $value ? 'Oui' : 'Non',
                is_array($value) => implode(', ', $value),
                $value === null || $value === '' => '—',
                default => (string) $value,
            };

            $scalarRows[] = [
                'label' => $field['label'] ?? $field['key'],
                'value' => $display,
                'unit' => $field['unit'] ?? null,
                'help' => $field['help'] ?? null,
            ];
        }

        $task = $form->missionTask;
        $om = $task?->ordreMissionLigne?->ordreMission;

        return [
            'essai_name' => $form->form_snapshot['name'] ?? $form->testType?->name ?? 'Essai',
            'norm' => $form->form_snapshot['norm'] ?? $form->testType?->norm,
            'description' => $form->testType?->description,
            'status' => $form->status,
            'task_number' => $task?->unique_number,
            'technicien' => $task?->assignedUser?->name,
            'client' => $om?->client?->name,
            'chantier' => $om?->site?->name,
            'dossier' => $om?->dossier?->reference,
            'submitted_at' => $form->submitted_at?->format('d/m/Y H:i'),
            'scalar_rows' => $scalarRows,
            'table_sections' => $tableSections,
            'photos' => $form->photos,
        ];
    }

    public static function filenameBase(array $data, TaskTestForm $form): string
    {
        $slug = preg_replace('/[^A-Za-z0-9]+/', '-', $data['essai_name']);
        $slug = trim($slug, '-') ?: 'essai';
        $number = $data['task_number'] ?? $form->id;

        return $slug.'-'.$number;
    }
}
