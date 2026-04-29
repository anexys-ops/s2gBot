<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TaskMeasure extends Model
{
    protected $fillable = [
        'mission_task_id',
        'measure_config_id',
        'value',
        'value_numeric',
        'is_conform',
        'attachment_path',
        'created_by',
    ];

    protected $casts = [
        'value_numeric' => 'float',
        'is_conform'    => 'boolean',
    ];

    public function missionTask(): BelongsTo
    {
        return $this->belongsTo(MissionTask::class, 'mission_task_id');
    }

    public function measureConfig(): BelongsTo
    {
        return $this->belongsTo(ActionMeasureConfig::class, 'measure_config_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(\App\Models\User::class, 'created_by');
    }

    /**
     * Auto-calcule is_conform lors de la sauvegarde si value_numeric est renseigné.
     */
    protected static function booted(): void
    {
        static::saving(function (self $measure) {
            if ($measure->value_numeric !== null && $measure->measureConfig) {
                $measure->is_conform = $measure->measureConfig->isValueConform($measure->value_numeric);
            }
        });

        static::saved(function (self $measure) {
            // Recalcule la conformité globale de la tâche
            $measure->missionTask?->recomputeConformity();
        });
    }
}
