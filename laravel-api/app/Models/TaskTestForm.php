<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TaskTestForm extends Model
{
    protected $fillable = [
        'mission_task_id', 'test_type_id', 'status', 'form_snapshot', 'answers',
        'correction_note', 'submitted_by', 'submitted_at', 'validated_by', 'validated_at',
    ];

    protected function casts(): array
    {
        return [
            'form_snapshot' => 'array', 'answers' => 'array',
            'submitted_at' => 'datetime', 'validated_at' => 'datetime',
        ];
    }

    public function missionTask(): BelongsTo { return $this->belongsTo(MissionTask::class); }
    public function testType(): BelongsTo { return $this->belongsTo(TestType::class); }
    public function photos(): HasMany { return $this->hasMany(TaskTestFormPhoto::class); }
}
