<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PlanningEquipment extends Model
{
    protected $fillable = [
        'equipment_id',
        'mission_task_id',
        'date_debut',
        'date_fin',
        'type_evenement',
        'notes',
    ];

    protected $casts = [
        'date_debut' => 'date',
        'date_fin'   => 'date',
    ];

    public function equipment(): BelongsTo
    {
        return $this->belongsTo(\App\Models\Equipment::class);
    }

    public function missionTask(): BelongsTo
    {
        return $this->belongsTo(MissionTask::class);
    }
}
