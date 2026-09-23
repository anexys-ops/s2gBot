<?php

namespace App\Services;

use App\Models\BonCommande;
use App\Models\MissionTask;
use App\Models\OrdreMission;

class BonCommandeMissionProgressService
{
    /** @return array{statut: string, total: int, cloturees: int, planifiees: int} */
    public function forBonCommande(BonCommande $bc): array
    {
        $orders = $bc->ordresMission()
            ->where('statut', '!=', OrdreMission::STATUT_ANNULE)
            ->with('lignes.missionTasks')
            ->get();
        $sourceLines = $bc->lignes->keyBy('id');
        $coverage = [];
        foreach ($orders as $order) {
            foreach ($order->lignes as $line) {
                if (! $line->bon_commande_ligne_id || $line->statut === 'annule') {
                    continue;
                }
                $key = ($line->ref_article_id ?? 0).':'.($line->article_action_id ?? 0);
                $coverage[$order->type][$line->bon_commande_ligne_id][$key] =
                    ($coverage[$order->type][$line->bon_commande_ligne_id][$key] ?? 0) + (float) $line->quantite;
            }
        }
        $hasRemainder = false;
        foreach ($coverage as $linesByType) {
            foreach ($linesByType as $sourceId => $definitions) {
                $source = $sourceLines->get($sourceId);
                if ($source && min($definitions) + 0.000001 < (float) $source->quantite) {
                    $hasRemainder = true;
                }
            }
        }
        $tasks = $orders->flatMap(fn (OrdreMission $order) => $order->lignes)
            ->filter(fn ($line) => $line->statut !== 'annule')
            ->flatMap(fn ($line) => $line->missionTasks)
            ->values();
        $total = $tasks->count();
        $closed = $tasks->where('statut', MissionTask::STATUT_VALIDATED)->count();
        $planned = $tasks->filter(fn (MissionTask $task) => $task->assigned_user_id && $task->planned_date)->count();

        if ($total === 0) {
            $status = 'a_planifier';
        } elseif ($closed === $total && ! $hasRemainder) {
            $status = 'cloture';
        } elseif ($tasks->contains(fn (MissionTask $task) => $task->statut === MissionTask::STATUT_FROZEN)) {
            $status = 'freeze';
        } elseif ($tasks->contains(fn (MissionTask $task) => $task->statut === MissionTask::STATUT_DONE)) {
            $status = 'attente_validation';
        } elseif ($tasks->contains(fn (MissionTask $task) => in_array($task->statut, [MissionTask::STATUT_IN_PROGRESS, MissionTask::STATUT_PAUSED], true))) {
            $status = 'en_cours';
        } elseif ($tasks->contains(fn (MissionTask $task) => $task->statut === MissionTask::STATUT_RESCHEDULED)) {
            $status = 'replanifie';
        } elseif ($tasks->contains(fn (MissionTask $task) => $task->planned_date
            && $task->planned_date->isBefore(today())
            && $task->statut === MissionTask::STATUT_TODO)) {
            $status = 'a_replanifier';
        } elseif ($planned === $total && ! $hasRemainder) {
            $status = 'planifie';
        } elseif ($planned > 0) {
            $status = 'planification_en_cours';
        } else {
            $status = 'a_planifier';
        }

        return [
            'statut' => $status,
            'total' => $total,
            'cloturees' => $closed,
            'planifiees' => $planned,
        ];
    }
}
