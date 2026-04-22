<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WorkflowStep extends Model
{
    protected $fillable = [
        'workflow_definition_id',
        'code',
        'label',
        'sort_order',
        'service_key',
        'can_edit',
        'can_approve',
        'can_reject',
        'sla_days',
    ];

    protected function casts(): array
    {
        return [
            'can_edit' => 'boolean',
            'can_approve' => 'boolean',
            'can_reject' => 'boolean',
        ];
    }

    public function definition(): BelongsTo
    {
        return $this->belongsTo(WorkflowDefinition::class, 'workflow_definition_id');
    }

    public function transitionsFrom(): HasMany
    {
        return $this->hasMany(WorkflowTransition::class, 'from_step_id');
    }

    public function transitionsTo(): HasMany
    {
        return $this->hasMany(WorkflowTransition::class, 'to_step_id');
    }
}
