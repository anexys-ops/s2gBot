<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockEquipment extends Model
{
    protected $fillable = [
        'equipment_id',
        'date_debut',
        'date_fin',
        'motif',
        'is_validated',
        'notes',
    ];

    protected $casts = [
        'date_debut'   => 'date',
        'date_fin'     => 'date',
        'is_validated' => 'boolean',
    ];

    public function equipment(): BelongsTo
    {
        return $this->belongsTo(\App\Models\Equipment::class);
    }
}
