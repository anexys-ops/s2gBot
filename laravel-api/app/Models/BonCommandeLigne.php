<?php

namespace App\Models;

use App\Models\Catalogue\Article;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BonCommandeLigne extends Model
{
    protected $table = 'bons_commande_lignes';

    public $timestamps = true;

    protected $fillable = [
        'bon_commande_id',
        'ref_article_id',
        'libelle',
        'ordre',
        'quantite',
        'prix_unitaire_ht',
        'tva_rate',
        'montant_ht',
        'date_debut_prevue',
        'date_fin_prevue',
        'technicien_id',
        'date_livraison',
        'notes_ligne',
    ];

    protected function casts(): array
    {
        return [
            'date_debut_prevue' => 'date',
            'date_fin_prevue' => 'date',
            'date_livraison' => 'date',
        ];
    }

    public function bonCommande(): BelongsTo
    {
        return $this->belongsTo(BonCommande::class, 'bon_commande_id');
    }

    public function article(): BelongsTo
    {
        return $this->belongsTo(Article::class, 'ref_article_id');
    }

    public function technicien(): BelongsTo
    {
        return $this->belongsTo(User::class, 'technicien_id');
    }

    public function planningAffectations(): HasMany
    {
        return $this->hasMany(BcLignePlanningAffectation::class, 'bon_commande_ligne_id');
    }
}
