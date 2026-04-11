<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ExtrafieldValue extends Model
{
    protected $fillable = [
        'extrafield_definition_id',
        'entity_id',
        'value',
    ];

    public function definition(): BelongsTo
    {
        return $this->belongsTo(ExtrafieldDefinition::class, 'extrafield_definition_id');
    }
}
