<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WorkflowDefinition extends Model
{
    protected $fillable = [
        'code',
        'name',
        'document_type',
        'active',
    ];

    protected function casts(): array
    {
        return [
            'active' => 'boolean',
        ];
    }

    public function steps(): HasMany
    {
        return $this->hasMany(WorkflowStep::class, 'workflow_definition_id')->orderBy('sort_order');
    }

    public function transitions(): HasMany
    {
        return $this->hasMany(WorkflowTransition::class, 'workflow_definition_id');
    }

    public function instances(): HasMany
    {
        return $this->hasMany(WorkflowInstance::class, 'workflow_definition_id');
    }
}
