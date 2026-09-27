<?php

namespace App\Services;

use App\Models\MissionTask;
use Barryvdh\DomPDF\Facade\Pdf;

class TaskMeasurementsPdfGenerator
{
    /** @return array{0: string, 1: string} */
    public function generate(MissionTask $task): array
    {
        $task->loadMissing([
            'assignedUser:id,name',
            'ordreMissionLigne.ordreMission.client:id,name',
            'ordreMissionLigne.ordreMission.dossier:id,reference',
            'measures.measureConfig',
            'testForms.testType:id,name,norm',
            'testForms.photos',
        ]);

        $forms = $task->testForms->map(function ($form) {
            $answers = $form->answers ?? [];
            $fields = $form->form_snapshot['fields'] ?? [];
            $rows = collect($fields)->map(function ($field) use ($answers, $form) {
                $value = $answers[$field['key']] ?? null;
                if (($field['type'] ?? '') === 'photo') {
                    $value = $form->photos->where('field_key', $field['key'])->pluck('original_name')->implode(', ');
                } elseif (($field['type'] ?? '') === 'table' && is_array($value)) {
                    $value = collect($value)->map(function ($row, $index) use ($field) {
                        $columns = collect($field['columns'] ?? [])->map(
                            fn ($column) => ($column['label'] ?? $column['key']).': '.($row[$column['key']] ?? '—')
                        )->implode(' · ');
                        return 'Ligne '.($index + 1).' — '.$columns;
                    })->implode(' | ');
                } elseif (is_array($value)) {
                    $value = implode(', ', $value);
                } elseif (is_bool($value)) {
                    $value = $value ? 'Oui' : 'Non';
                }

                return [
                    'label' => $field['label'] ?? $field['key'],
                    'value' => ($value === null || $value === '') ? '—' : (string) $value,
                    'unit' => $field['unit'] ?? null,
                ];
            });

            return [
                'name' => $form->form_snapshot['name'] ?? $form->testType?->name ?? 'Essai',
                'norm' => $form->form_snapshot['norm'] ?? $form->testType?->norm,
                'status' => $form->status,
                'rows' => $rows,
            ];
        });

        $pdf = Pdf::loadView('pdf.task_measurements', ['task' => $task, 'forms' => $forms]);
        $pdf->getDomPDF()->setPaper('A4', 'portrait');
        $number = preg_replace('/[^A-Za-z0-9_-]/', '-', $task->unique_number ?? (string) $task->id);

        return [$pdf->output(), 'mesures-'.$number.'.pdf'];
    }
}
