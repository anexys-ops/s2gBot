<?php

namespace App\Services;

use App\Models\MissionTask;
use App\Models\OrdreMission;
use App\Models\OrdreMissionLigne;
use App\Models\PlanningEquipment;
use App\Models\PlanningHuman;

class MissionTaskStatusService
{
    public function syncOrdreMissionFromTask(MissionTask $task): void
    {
        $task->loadMissing('ordreMissionLigne.ordreMission');
        $ligne = $task->ordreMissionLigne;
        if (! $ligne) {
            return;
        }

        $ligne->update([
            'assigned_user_id' => $task->assigned_user_id,
            'date_prevue' => $task->planned_date,
            'statut' => match ($task->statut) {
                MissionTask::STATUT_IN_PROGRESS, MissionTask::STATUT_PAUSED => 'en_cours',
                MissionTask::STATUT_FROZEN => 'freeze',
                MissionTask::STATUT_RESCHEDULED => 'replanifie',
                MissionTask::STATUT_DONE => 'attente_validation',
                MissionTask::STATUT_VALIDATED => 'cloture',
                MissionTask::STATUT_REJECTED => 'annule',
                default => 'planifie',
            },
        ]);

        $this->syncPlanningFromTask($task, $ligne);
        $this->syncOrdreMissionStatus($ligne->ordreMission);
    }

    private function syncPlanningFromTask(MissionTask $task, OrdreMissionLigne $ligne): void
    {
        $date = $task->planned_date?->format('Y-m-d');

        if ($task->assigned_user_id && $date) {
            PlanningHuman::query()->updateOrCreate(
                ['mission_task_id' => $task->id],
                [
                    'user_id' => $task->assigned_user_id,
                    'date_debut' => $date,
                    'date_fin' => $date,
                    'type_evenement' => 'tache',
                    'notes' => $ligne->libelle,
                ]
            );
        } else {
            PlanningHuman::query()->where('mission_task_id', $task->id)->get()->each->delete();
        }

        if ($ligne->equipment_id && $date) {
            PlanningEquipment::query()->updateOrCreate(
                ['mission_task_id' => $task->id],
                [
                    'equipment_id' => $ligne->equipment_id,
                    'user_id' => $task->assigned_user_id,
                    'date_debut' => $date,
                    'date_fin' => $date,
                    'type_evenement' => 'utilisation',
                    'notes' => $ligne->libelle,
                ]
            );
        } else {
            PlanningEquipment::query()->where('mission_task_id', $task->id)->get()->each->delete();
        }
    }

    private function syncOrdreMissionStatus(?OrdreMission $ordreMission): void
    {
        if (! $ordreMission) {
            return;
        }

        $lignes = $ordreMission->lignes()->get();
        if ($lignes->isEmpty()) {
            return;
        }

        if ($lignes->every(fn (OrdreMissionLigne $ligne) => $ligne->statut === 'annule')) {
            $ordreMission->update(['statut' => OrdreMission::STATUT_ANNULE]);
            return;
        }
        if ($lignes->every(fn (OrdreMissionLigne $ligne) => in_array($ligne->statut, ['cloture', 'annule'], true))) {
            $ordreMission->update([
                'statut' => OrdreMission::STATUT_TERMINE,
                'date_debut' => $ordreMission->date_debut ?? now(),
                'date_fin' => $ordreMission->date_fin ?? now(),
            ]);
            return;
        }
        if ($lignes->contains(fn (OrdreMissionLigne $ligne) => in_array($ligne->statut, ['en_cours', 'freeze', 'attente_validation', 'cloture'], true))) {
            $ordreMission->update([
                'statut' => OrdreMission::STATUT_EN_COURS,
                'date_debut' => $ordreMission->date_debut ?? now(),
            ]);
            return;
        }
        $active = $lignes->reject(fn (OrdreMissionLigne $ligne) => $ligne->statut === 'annule');
        $ordreMission->update(['statut' => $active->isNotEmpty()
            && $active->contains(fn (OrdreMissionLigne $ligne) => $ligne->assigned_user_id && $ligne->date_prevue)
            ? OrdreMission::STATUT_PLANIFIE
            : OrdreMission::STATUT_BROUILLON]);
    }

}
