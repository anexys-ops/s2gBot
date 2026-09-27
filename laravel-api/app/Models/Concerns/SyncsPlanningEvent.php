<?php

namespace App\Models\Concerns;

use App\Models\PlanningEvent;

trait SyncsPlanningEvent
{
    protected static function bootSyncsPlanningEvent(): void
    {
        static::saved(function ($source) {
            if (method_exists($source, 'planningEventShouldSync') && ! $source->planningEventShouldSync()) {
                PlanningEvent::query()->where('source_type', $source->planningEventSourceType())
                    ->where('source_id', $source->getKey())->delete();
                return;
            }
            PlanningEvent::query()->updateOrCreate(
                ['source_type' => $source->planningEventSourceType(), 'source_id' => $source->getKey()],
                $source->planningEventAttributes(),
            );
        });

        static::deleted(function ($source) {
            PlanningEvent::query()
                ->where('source_type', $source->planningEventSourceType())
                ->where('source_id', $source->getKey())
                ->delete();
        });
    }

    protected function planningEventAttributes(): array
    {
        return $this->basePlanningEventAttributes();
    }

    protected function basePlanningEventAttributes(): array
    {
        return [
            'user_id' => $this->user_id ?? null,
            'equipment_id' => $this->equipment_id ?? null,
            'mission_task_id' => $this->mission_task_id ?? null,
            'bon_commande_ligne_id' => $this->bon_commande_ligne_id ?? null,
            'date_debut' => $this->date_debut?->format('Y-m-d'),
            'date_fin' => $this->date_fin?->format('Y-m-d'),
            'heure_debut' => $this->heure_debut ?? null,
            'heure_fin' => $this->heure_fin ?? null,
            'type_evenement' => $this->type_evenement ?? $this->motif ?? $this->planningEventSourceType(),
            'is_validated' => $this->is_validated ?? null,
            'notes' => $this->notes ?? null,
        ];
    }

    abstract protected function planningEventSourceType(): string;
}
