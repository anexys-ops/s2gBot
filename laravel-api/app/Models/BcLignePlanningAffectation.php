<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BcLignePlanningAffectation extends Model
{
    protected $table = 'bc_ligne_planning_affectations';

    protected $fillable = [
        'bon_commande_ligne_id',
        'user_id',
        'date_debut',
        'date_fin',
        'notes',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'date_debut' => 'date',
            'date_fin' => 'date',
        ];
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        $array = parent::toArray();
        foreach (['date_debut', 'date_fin'] as $attr) {
            if ($this->{$attr} !== null) {
                $array[$attr] = $this->{$attr}->format('Y-m-d');
            }
        }

        return $array;
    }

    public function bonCommandeLigne(): BelongsTo
    {
        return $this->belongsTo(BonCommandeLigne::class, 'bon_commande_ligne_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function createur(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
