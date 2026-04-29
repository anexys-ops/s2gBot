<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TaskResult extends Model
{
    protected $fillable = [
        'mission_task_id',
        'is_conform',
        'value_final',
        'conclusion',
        'observations',
        'validated_by',
        'validated_at',
        'rapport_path',
    ];

    protected $casts = [
        'is_conform'   => 'boolean',
        'value_final'  => 'float',
        'validated_at' => 'datetime',
    ];

    public function missionTask(): BelongsTo
    {
        return $this->belongsTo(MissionTask::class, 'mission_task_id');
    }

    public function validatedBy(): BelongsTo
    {
        return $this->belongsTo(\App\Models\User::class, 'validated_by');
    }
}
