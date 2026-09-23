<?php

namespace App\Services;

use App\Models\MissionTask;
use App\Models\OrdreMission;
use App\Models\OrdreMissionLigne;
use App\Models\Sample;

class MissionTaskClosureService
{
    public function __construct(private readonly TaskFormAssignmentService $formAssignments) {}

    public function afterSampleReceived(Sample $sample, ?int $validatedBy): void
    {
        if (! $sample->task_id) {
            return;
        }

        $task = MissionTask::query()->find($sample->task_id);
        if (! $task || ! $task->reception_generated_at) {
            return;
        }

        $samples = Sample::query()->where('task_id', $task->id);
        if ($samples->count() < max(1, (int) $task->quantity_count) || (clone $samples)->whereNotIn('status', [
            Sample::STATUS_RECEPTIONNE,
            Sample::STATUS_IMPRIME,
            Sample::STATUS_EN_ESSAI,
            Sample::STATUS_TERMINE,
            Sample::STATUS_STOCKE,
            Sample::STATUS_ARCHIVE,
        ])->exists()) {
            return;
        }

        $this->validate($task, $validatedBy);
    }

    public function validate(MissionTask $task, ?int $validatedBy): void
    {
        if ($this->formAssignments->hasPendingForms($task)) {
            return;
        }

        if ($task->statut !== MissionTask::STATUT_VALIDATED) {
            $task->update([
                'statut' => MissionTask::STATUT_VALIDATED,
                'completed_at' => $task->completed_at ?? now(),
                'validated_at' => $task->validated_at ?? now(),
                'validated_by' => $validatedBy,
            ]);
        }

        $line = $task->ordreMissionLigne;
        if (! $line) {
            return;
        }
        if ($line->statut !== 'cloture') {
            $line->update(['statut' => 'cloture']);
        }

        $om = $line->ordreMission;
        if (! $om) {
            return;
        }
        $lines = $om->lignes()->get();
        if ($lines->isNotEmpty() && $lines->every(fn (OrdreMissionLigne $item) => in_array($item->statut, ['cloture', 'annule'], true))) {
            $om->update([
                'statut' => OrdreMission::STATUT_TERMINE,
                'date_debut' => $om->date_debut ?? now(),
                'date_fin' => $om->date_fin ?? now(),
            ]);
        } elseif ($om->statut !== OrdreMission::STATUT_EN_COURS) {
            $om->update([
                'statut' => OrdreMission::STATUT_EN_COURS,
                'date_debut' => $om->date_debut ?? now(),
            ]);
        }
    }
}
