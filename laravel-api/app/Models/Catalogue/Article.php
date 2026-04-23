<?php

namespace App\Models\Catalogue;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Article extends Model
{
    use SoftDeletes;

    protected $table = 'ref_articles';

    protected $fillable = [
        'ref_famille_article_id',
        'ref_article_lie_id',
        'code',
        'code_interne',
        'sku',
        'libelle',
        'description',
        'description_commerciale',
        'description_technique',
        'tags',
        'unite',
        'hfsql_unite',
        'prix_unitaire_ht',
        'prix_revient_ht',
        'tva_rate',
        'duree_estimee',
        'normes',
        'actif',
    ];

    protected $appends = [
        'prix_unitaire_ht_formate',
    ];

    protected function casts(): array
    {
        return [
            'prix_unitaire_ht' => 'decimal:2',
            'prix_revient_ht' => 'decimal:2',
            'tva_rate' => 'decimal:2',
            'duree_estimee' => 'integer',
            'actif' => 'boolean',
            'tags' => 'array',
        ];
    }

    protected function prixUnitaireHtFormate(): Attribute
    {
        return Attribute::get(function (): string {
            return number_format((float) $this->prix_unitaire_ht, 2, ',', ' ').' € HT';
        });
    }

    public function famille(): BelongsTo
    {
        return $this->belongsTo(FamilleArticle::class, 'ref_famille_article_id');
    }

    /** Article de regroupement (autre fiche liée) — ex. HFSQL regroupement */
    public function articleLie(): BelongsTo
    {
        return $this->belongsTo(self::class, 'ref_article_lie_id');
    }

    /** Fiches référençant celle-ci comme liée */
    public function articlesEnLienDepuisIci(): HasMany
    {
        return $this->hasMany(self::class, 'ref_article_lie_id');
    }

    public function famillePackages(): HasMany
    {
        return $this->hasMany(FamillePackage::class, 'ref_article_id');
    }

    public function parametresEssai(): HasMany
    {
        return $this->hasMany(ParametreEssai::class, 'ref_article_id');
    }

    public function resultats(): HasMany
    {
        return $this->hasMany(Resultat::class, 'ref_article_id');
    }

    public function scopeActif(Builder $query): Builder
    {
        return $query->where('actif', true);
    }

    public function scopeOrdonne(Builder $query): Builder
    {
        return $query->orderBy('code');
    }
}
