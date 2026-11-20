<?php

namespace App\Services;

use App\Models\BonCommandeLigne;
use App\Models\MissionTask;
use App\Models\OrdreMission;
use App\Models\Sample;
use Carbon\Carbon;

/**
 * Rattache automatiquement le FOLD d'une mission terrain aux tâches laboratoire du même jalon :
 * pour chaque produit labo du jalon, l'échantillon va à la première tâche labo encore sans FOLD.
 * Ainsi la tâche labo affiche directement « son » FOLD (puis son Transco après réception),
 * sans sélection manuelle. Un rattachement manuel reste possible depuis la tâche.
 */
class LabTaskSampleLinker
{
    /** Échantillons arrivés au labo. */
    private const RECEIVED_STATUSES = [
        Sample::STATUS_RECEPTIONNE, Sample::STATUS_IMPRIME, Sample::STATUS_EN_ESSAI,
        Sample::STATUS_TERMINE, Sample::STATUS_STOCKE, Sample::STATUS_ARCHIVE,
    ];

    /** Échantillons qui ne doivent plus être rattachés. */
    private const DEAD_STATUSES = [Sample::STATUS_ANNULE, Sample::STATUS_PERDU, Sample::STATUS_REJETE];

    public function __construct(
        private readonly DevisJalonResolver $jalonResolver,
    ) {}

    /**
     * Mission terrain d'origine d'un échantillon réceptionné directement depuis la ligne de BC
     * (écran Réception) : la mission de prélèvement de cette ligne qui a un n° de PV, en
     * répartissant les échantillons sur les missions qui en ont le moins. Null si aucune.
     */
    public function inferTerrainTaskId(int $bonCommandeLigneId): ?int
    {
        $tasks = MissionTask::query()
            ->whereNotIn('statut', [MissionTask::STATUT_REJECTED])
            ->whereNotNull('pv_numbers')
            ->whereHas('ordreMissionLigne', fn ($q) => $q
                ->where('bon_commande_ligne_id', $bonCommandeLigneId)
                ->whereHas('ordreMission', fn ($om) => $om->where('type', OrdreMission::TYPE_TECHNICIEN)))
            ->withCount(['ownSamples as samples_count'])
            ->orderBy('id')
            ->get()
            ->filter(fn (MissionTask $t) => ! empty($t->pv_numbers));

        return $tasks->sortBy('samples_count')->first()?->id;
    }

    /** @return int nombre de tâches labo rattachées */
    public function linkSample(Sample $sample): int
    {
        if (! $sample->bon_commande_ligne_id
            || in_array($sample->status, self::DEAD_STATUSES, true)
            || $sample->labTasks()->exists()) {
            return 0;
        }

        $ligne = BonCommandeLigne::query()->with('bonCommande.quote')->find($sample->bon_commande_ligne_id);
        $bc = $ligne?->bonCommande;
        if (! $bc || ! $ligne->ref_article_id) {
            return 0;
        }
        // BC sans jalons : impossible de savoir quelles tâches labo correspondent à la mission.
        $refIds = $this->jalonResolver->siblingRefArticleIds($bc, (int) $ligne->ref_article_id);
        if ($refIds === null) {
            return 0;
        }
        $siblingLineIds = BonCommandeLigne::query()
            ->where('bon_commande_id', $bc->id)
            ->whereIn('ref_article_id', $refIds)
            ->pluck('id')
            ->all();

        $isReceived = in_array($sample->status, self::RECEIVED_STATUSES, true);
        $candidates = MissionTask::query()
            ->where('no_fold_required', false)
            ->whereNotIn('statut', [MissionTask::STATUT_VALIDATED, MissionTask::STATUT_REJECTED])
            // Tâche libre, ou — pour un échantillon réellement arrivé au labo — tâche qui ne porte
            // qu'un FOLD resté en transit (jamais réceptionné, ex. réception refaite depuis la ligne de BC).
            ->where(fn ($q) => $isReceived
                ? $q->whereDoesntHave('samples', fn ($sq) => $sq->whereIn('samples.status', self::RECEIVED_STATUSES))
                : $q->whereDoesntHave('samples'))
            ->whereHas('ordreMissionLigne', fn ($q) => $q
                ->whereIn('bon_commande_ligne_id', $siblingLineIds)
                ->whereHas('ordreMission', fn ($om) => $om
                    ->where('type', OrdreMission::TYPE_LABO)
                    ->where('bon_commande_id', $bc->id)))
            ->with(['ordreMissionLigne:id,bon_commande_ligne_id,article_action_id', 'samples:id,status'])
            ->orderBy('id')
            ->lockForUpdate()
            ->get();

        $linked = 0;
        $byProduct = $candidates->groupBy(fn (MissionTask $t) => $t->ordreMissionLigne?->bon_commande_ligne_id.'|'.$t->ordreMissionLigne?->article_action_id);
        foreach ($byProduct as $tasks) {
            // Une tâche vraiment libre d'abord, sinon celle dont le FOLD n'est jamais arrivé.
            /** @var MissionTask $task */
            $task = $tasks->first(fn (MissionTask $t) => $t->samples->isEmpty()) ?? $tasks->first();
            $stale = $task->samples->pluck('id')->all();
            if ($stale !== []) {
                $task->samples()->detach($stale);
            }
            $task->samples()->syncWithoutDetaching([$sample->id => ['forced' => false]]);
            $this->planAfterReception($task, $sample);
            $linked++;
        }

        return $linked;
    }

    /** À la réception : rattachement si besoin, puis planification des tâches labo liées. */
    public function afterReception(Sample $sample): void
    {
        $this->linkSample($sample);
        foreach ($sample->labTasks()->get() as $task) {
            $this->planAfterReception($task, $sample);
        }
    }

    /** Première planification : lendemain ouvré de la réception, si aucune date n'est fixée. */
    private function planAfterReception(MissionTask $task, Sample $sample): void
    {
        if ($task->planned_date || ! $sample->received_at) {
            return;
        }
        $date = Carbon::parse($sample->received_at)->addDay();
        while ($date->isWeekend()) {
            $date->addDay();
        }
        $task->update(['planned_date' => $date->toDateString()]);
    }
}
