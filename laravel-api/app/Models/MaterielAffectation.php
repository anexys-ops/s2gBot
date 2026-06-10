<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MaterielAffectation extends Model
{
    protected $table = 'materiel_affectations';

    protected $fillable = [
        'equipment_id',
        'dossier_id',
        'user_id',
        'ordre_mission_id',
        'date_debut',
        'date_retour_prevue',
        'date_retour_effective',
        'etat_depart',
        'etat_retour',
        'observations',
    ];

    protected function casts(): array
    {
        return [
            'date_debut' => 'date',
            'date_retour_prevue' => 'date',
            'date_retour_effective' => 'date',
        ];
    }

    public function equipment(): BelongsTo
    {
        return $this->belongsTo(Equipment::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function dossier(): BelongsTo
    {
        return $this->belongsTo(Dossier::class);
    }

    public function effectiveEndDate(): Carbon
    {
        $end = $this->date_retour_effective ?? $this->date_retour_prevue ?? $this->date_debut;

        return $end->copy()->startOfDay();
    }

    public function isActiveOn(string $date): bool
    {
        $day = Carbon::parse($date)->startOfDay();
        $start = $this->date_debut->copy()->startOfDay();
        $end = $this->effectiveEndDate();

        return $day->betweenIncluded($start, $end);
    }
}
