<?php

namespace App\Models;

use App\Models\Concerns\SyncsPlanningEvent;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockPersonnel extends Model
{
    use SyncsPlanningEvent;

    protected function planningEventSourceType(): string { return 'stock_personnel'; }

    protected $fillable = [
        'user_id',
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

    public function user(): BelongsTo
    {
        return $this->belongsTo(\App\Models\User::class);
    }
}
