<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PlanningEvent extends Model
{
    protected $fillable = [
        'source_type', 'source_id', 'user_id', 'equipment_id',
        'mission_task_id', 'bon_commande_ligne_id', 'dossier_id', 'ordre_mission_id', 'date_debut', 'date_fin',
        'heure_debut', 'heure_fin', 'type_evenement', 'is_validated', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'date_debut' => 'date',
            'date_fin' => 'date',
            'is_validated' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function equipment(): BelongsTo
    {
        return $this->belongsTo(Equipment::class);
    }

    public function missionTask(): BelongsTo
    {
        return $this->belongsTo(MissionTask::class);
    }

    public function bonCommandeLigne(): BelongsTo
    {
        return $this->belongsTo(BonCommandeLigne::class);
    }
}
