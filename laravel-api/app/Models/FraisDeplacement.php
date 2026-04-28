<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FraisDeplacement extends Model
{
    protected $table = 'frais_deplacement';

    protected $fillable = [
        'ordre_mission_id',
        'user_id',
        'date',
        'lieu_depart',
        'lieu_arrivee',
        'distance_km',
        'taux_km',
        'type_transport',
        'notes',
        'statut',
    ];

    protected $appends = ['montant'];

    protected function casts(): array
    {
        return [
            'date'        => 'date',
            'distance_km' => 'float',
            'taux_km'     => 'float',
        ];
    }

    /** Montant aller-retour calculé */
    public function getMontantAttribute(): float
    {
        return round($this->distance_km * $this->taux_km * 2, 2);
    }

    public function ordreMission(): BelongsTo
    {
        return $this->belongsTo(OrdreMission::class, 'ordre_mission_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
