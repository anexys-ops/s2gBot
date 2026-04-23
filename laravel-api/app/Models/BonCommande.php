<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class BonCommande extends Model
{
    use SoftDeletes;

    protected $table = 'bons_commande';

    protected $fillable = [
        'numero',
        'quote_id',
        'dossier_id',
        'client_id',
        'statut',
        'date_commande',
        'date_livraison_prevue',
        'montant_ht',
        'montant_ttc',
        'tva_rate',
        'notes',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'date_commande' => 'date',
            'date_livraison_prevue' => 'date',
        ];
    }

    public function dossier(): BelongsTo
    {
        return $this->belongsTo(Dossier::class);
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function quote(): BelongsTo
    {
        return $this->belongsTo(Quote::class);
    }

    public function createur(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function lignes(): HasMany
    {
        return $this->hasMany(BonCommandeLigne::class, 'bon_commande_id');
    }
}
