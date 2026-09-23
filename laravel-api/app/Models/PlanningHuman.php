<?php

namespace App\Models;

use App\Models\Concerns\SyncsPlanningEvent;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PlanningHuman extends Model
{
    use SyncsPlanningEvent;

    protected function planningEventSourceType(): string { return 'human'; }

    protected $fillable = [
        'user_id',
        'mission_task_id',
        'date_debut',
        'date_fin',
        'heure_debut',
        'heure_fin',
        'type_evenement',
        'notes',
    ];

    protected $casts = [
        'date_debut' => 'date',
        'date_fin'   => 'date',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(\App\Models\User::class);
    }

    public function missionTask(): BelongsTo
    {
        return $this->belongsTo(MissionTask::class);
    }
}
