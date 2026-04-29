<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ActionMeasureConfig extends Model
{
    protected $fillable = [
        'article_action_id',
        'field_name',
        'field_type',
        'unit',
        'min_value',
        'max_value',
        'select_options',
        'is_required',
        'placeholder',
        'help_text',
        'ordre',
    ];

    protected $casts = [
        'select_options' => 'array',
        'is_required'    => 'boolean',
        'min_value'      => 'float',
        'max_value'      => 'float',
        'ordre'          => 'integer',
    ];

    public function articleAction(): BelongsTo
    {
        return $this->belongsTo(ArticleAction::class, 'article_action_id');
    }

    public function taskMeasures(): HasMany
    {
        return $this->hasMany(TaskMeasure::class, 'measure_config_id');
    }

    /**
     * Vérifie si une valeur numérique est dans les bornes définies.
     */
    public function isValueConform(?float $value): ?bool
    {
        if ($value === null) {
            return null;
        }
        if ($this->min_value === null && $this->max_value === null) {
            return null; // pas de bornes = non évaluable
        }
        $ok = true;
        if ($this->min_value !== null && $value < $this->min_value) {
            $ok = false;
        }
        if ($this->max_value !== null && $value > $this->max_value) {
            $ok = false;
        }
        return $ok;
    }
}
