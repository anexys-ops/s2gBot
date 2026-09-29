<?php

namespace App\Services;

use App\Models\MissionTask;
use App\Models\OrderItem;
use App\Models\OrdreMission;
use App\Models\OrdreMissionLigne;
use App\Models\PlanningEquipment;
use App\Models\PlanningHuman;
use App\Models\Sample;
use App\Models\Sequence;
use Illuminate\Support\Facades\Schema;

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

    public function syncPlanningFromTask(MissionTask $task, OrdreMissionLigne $ligne): void
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

    public function syncOrdreMissionStatus(?OrdreMission $ordreMission): void
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

    /**
     * Génère automatiquement 1 échantillon/FOLD de réception quand une tâche de
     * prélèvement terrain est terminée depuis l'application mobile (le technicien
     * n'y saisit qu'un statut + des numéros de PV, jamais de quantité d'étiquettes
     * contrairement au BO — sans cet auto-générateur la tâche n'apparaît jamais
     * en réception). No-op silencieux si la tâche n'est pas éligible : ne doit
     * jamais empêcher le technicien de clôturer sa tâche sur mobile.
     */
    public function autoGenerateReceptionFromMobile(MissionTask $task): void
    {
        if ($task->reception_generated_at || empty($task->pv_numbers)) {
            return;
        }

        $task->loadMissing(['ordreMissionLigne.ordreMission', 'ordreMissionLigne.bonCommandeLigne']);
        $ligne = $task->ordreMissionLigne;
        $source = $ligne?->bonCommandeLigne;
        $ordreMission = $ligne?->ordreMission;
        if (! $source || ! $ordreMission || $ordreMission->type !== OrdreMission::TYPE_TECHNICIEN) {
            return;
        }
        if (Sample::query()->where('task_id', $task->id)->exists()) {
            return;
        }

        $received = Sample::query()
            ->where('bon_commande_ligne_id', $source->id)
            ->whereNotIn('status', [Sample::STATUS_ANNULE, Sample::STATUS_REJETE])
            ->count();
        $remaining = max(0, (int) floor((float) $source->quantite) - $received);
        if ($remaining < 1) {
            return;
        }

        $quantityUnit = $task->quantity_unit ?: ($ligne?->article?->unite ?: 'point');
        $pv = implode(', ', $task->pv_numbers);

        $task->update([
            'quantity_unit' => $quantityUnit,
            'quantity_count' => 1,
            'reception_generated_at' => now(),
        ]);

        $sampleData = [
            'reference' => Sequence::next('ECH'),
            'reception_index' => 1,
            'reception_batch_total' => 1,
            'dossier_id' => $ordreMission->dossier_id,
            'mission_order_id' => $ordreMission->id,
            'task_id' => $task->id,
            'prepared_by_task_at' => now(),
            'product_id' => $source->ref_article_id,
            'bon_commande_ligne_id' => $source->id,
            'description' => $source->libelle,
            'sample_type' => 'autre',
            'collected_by' => $task->assigned_user_id,
            'collected_at' => now(),
            'status' => Sample::STATUS_EN_TRANSIT,
            'quantity' => 1,
            'notes' => "PV : {$pv} · Unité : {$quantityUnit} · Généré automatiquement (clôture mobile)",
        ];
        if (Schema::getConnection()->getDriverName() === 'sqlite') {
            $sampleData['order_item_id'] = OrderItem::query()->value('id');
        }
        Sample::query()->create($sampleData);
    }

}
