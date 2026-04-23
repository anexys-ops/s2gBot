<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class BonLivraison extends Model
{
    use SoftDeletes;

    public const STATUT_BROUILLON = 'brouillon';

    public const STATUT_LIVRE = 'livre';

    public const STATUT_SIGNE = 'signe';

    protected $table = 'bons_livraison';

    protected $fillable = [
        'numero',
        'bon_commande_id',
        'dossier_id',
        'client_id',
        'statut',
        'date_livraison',
        'notes',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'date_livraison' => 'date',
        ];
    }

    public function bonCommande(): BelongsTo
    {
        return $this->belongsTo(BonCommande::class, 'bon_commande_id');
    }

    public function dossier(): BelongsTo
    {
        return $this->belongsTo(Dossier::class);
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function createur(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function lignes(): HasMany
    {
        return $this->hasMany(BonLivraisonLigne::class, 'bon_livraison_id');
    }
}
