<?php

namespace App\Models;

use App\Models\Catalogue\Article;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

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
    ];

    public function bonCommande(): BelongsTo
    {
        return $this->belongsTo(BonCommande::class, 'bon_commande_id');
    }

    public function article(): BelongsTo
    {
        return $this->belongsTo(Article::class, 'ref_article_id');
    }
}
