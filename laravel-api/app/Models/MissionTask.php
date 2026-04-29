<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class MissionTask extends Model
{
    use SoftDeletes;

    const STATUT_TODO       = 'todo';
    const STATUT_IN_PROGRESS = 'in_progress';
    const STATUT_DONE       = 'done';
    const STATUT_VALIDATED  = 'validated';
    const STATUT_REJECTED   = 'rejected';

    protected $fillable = [
        'unique_number',
        'ordre_mission_ligne_id',
        'assigned_user_id',
        'statut',
        'planned_date',
        'due_date',
        'started_at',
        'completed_at',
        'validated_at',
        'validated_by',
        'notes',
        'is_conform',
    ];

    protected $casts = [
        'planned_date'   => 'date',
        'due_date'       => 'date',
        'started_at'     => 'datetime',
        'completed_at'   => 'datetime',
        'validated_at'   => 'datetime',
        'is_conform'     => 'boolean',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $model) {
            if (!$model->unique_number) {
                $model->unique_number = Sequence::next('TSK');
            }
        });
    }

    public function ordreMissionLigne(): BelongsTo
    {
        return $this->belongsTo(OrdreMissionLigne::class, 'ordre_mission_ligne_id');
    }

    public function assignedUser(): BelongsTo
    {
        return $this->belongsTo(\App\Models\User::class, 'assigned_user_id');
    }

    public function validatedBy(): BelongsTo
    {
        return $this->belongsTo(\App\Models\User::class, 'validated_by');
    }

    public function measures(): HasMany
    {
        return $this->hasMany(TaskMeasure::class, 'mission_task_id');
    }

    public function result(): HasOne
    {
        return $this->hasOne(TaskResult::class, 'mission_task_id');
    }

    public function planningHumans(): HasMany
    {
        return $this->hasMany(PlanningHuman::class, 'mission_task_id');
    }

    public function planningEquipments(): HasMany
    {
        return $this->hasMany(PlanningEquipment::class, 'mission_task_id');
    }

    /**
     * Recalcule is_conform à partir des mesures enregistrées.
     */
    public function recomputeConformity(): void
    {
        $measures = $this->measures()->whereNotNull('is_conform')->get();
        if ($measures->isEmpty()) {
            $this->is_conform = null;
        } else {
            $this->is_conform = $measures->every(fn ($m) => $m->is_conform === true);
        }
        $this->saveQuietly();
    }
}
