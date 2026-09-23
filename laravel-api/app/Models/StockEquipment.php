<?php

namespace App\Models;

use App\Models\Concerns\SyncsPlanningEvent;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockEquipment extends Model
{
    use SyncsPlanningEvent;

    protected function planningEventSourceType(): string { return 'stock_equipment'; }

    protected $table = 'stock_equipments';

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
