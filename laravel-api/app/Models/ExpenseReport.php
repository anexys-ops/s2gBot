<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ExpenseReport extends Model
{
    use SoftDeletes;

    const STATUT_BROUILLON  = 'brouillon';
    const STATUT_SOUMIS     = 'soumis';
    const STATUT_VALIDE     = 'valide';
    const STATUT_REMBOURSE  = 'rembourse';
    const STATUT_REJETE     = 'rejete';

    protected $fillable = [
        'unique_number',
        'ordre_mission_id',
        'statut',
        'notes',
        'created_by',
        'validated_by',
        'validated_at',
    ];

    protected $casts = [
        'validated_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $model) {
            if (!$model->unique_number) {
                $model->unique_number = Sequence::next('NDF');
            }
        });
    }

    public function ordreMission(): BelongsTo
    {
        return $this->belongsTo(OrdreMission::class, 'ordre_mission_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(\App\Models\User::class, 'created_by');
    }

    public function validatedBy(): BelongsTo
    {
        return $this->belongsTo(\App\Models\User::class, 'validated_by');
    }

    public function lines(): HasMany
    {
        return $this->hasMany(ExpenseLine::class, 'expense_report_id');
    }

    public function getTotalAttribute(): float
    {
        return (float) $this->lines()->sum('amount');
    }
}
