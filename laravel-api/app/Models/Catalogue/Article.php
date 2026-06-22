<?php

namespace App\Models\Catalogue;

use App\Models\ArticleAction;
use App\Models\ArticleEquipmentRequirement;
use App\Models\JalonProduct;
use App\Models\QualificationTag;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Article extends Model
{
    use SoftDeletes;

    public const KIND_JALON = 'jalon';

    public const KIND_PRODUCT = 'product';

    public const KIND_LEGACY = 'legacy';

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
        'kind',
        'famille_label',
        // v1.2.0 — déclencheurs workflow & ressources
        'triggers_odm_terrain',
        'triggers_odm_labo',
        'triggers_odm_ingenieur',
        'triggers_ndf',
        'triggers_materiel_booking',
        'nb_par_sondage',
        'type_ressource',
    ];

    protected $appends = [
        'prix_unitaire_ht_formate',
    ];

    protected function casts(): array
    {
        return [
            'prix_unitaire_ht'         => 'decimal:2',
            'prix_revient_ht'          => 'decimal:2',
            'tva_rate'                 => 'decimal:2',
            'duree_estimee'            => 'integer',
            'actif'                    => 'boolean',
            'tags'                     => 'array',
            // v1.2.0 — déclencheurs & ressources
            'triggers_odm_terrain'     => 'boolean',
            'triggers_odm_labo'        => 'boolean',
            'triggers_odm_ingenieur'   => 'boolean',
            'triggers_ndf'             => 'boolean',
            'triggers_materiel_booking' => 'boolean',
            'nb_par_sondage'           => 'integer',
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

    public function actions(): HasMany
    {
        return $this->hasMany(ArticleAction::class, 'ref_article_id')->orderBy('ordre');
    }

    public function equipmentRequirements(): HasMany
    {
        return $this->hasMany(ArticleEquipmentRequirement::class, 'ref_article_id');
    }

    public function scopeOrdonne(Builder $query): Builder
    {
        return $query->orderBy('code');
    }

    /** Articles du nouveau catalogue S2G (hors legacy PROLAB / géo). */
    public function scopeCatalogueS2g(Builder $query): Builder
    {
        return $query->whereIn('kind', [self::KIND_JALON, self::KIND_PRODUCT]);
    }

    /** True une fois le jeu S2G importé (au moins un jalon ou produit). */
    public static function hasS2gCatalogue(): bool
    {
        return static::query()->catalogueS2g()->exists();
    }

    /**
     * Filtre liste catalogue : S2G uniquement si importé, sinon legacy visible
     * (évite une liste vide avant `catalogue:import-s2g`).
     */
    public function scopeForCatalogueListing(Builder $query, bool $withLegacy = false): Builder
    {
        if ($withLegacy || ! static::hasS2gCatalogue()) {
            return $query;
        }

        return $query->catalogueS2g();
    }

    // ── Compositions (v1.2.0) ────────────────────────────────────────────────

    public function compositions(): HasMany
    {
        return $this->hasMany(ArticleComposition::class, 'parent_article_id')->orderBy('ordre');
    }

    public function composedIn(): HasMany
    {
        return $this->hasMany(ArticleComposition::class, 'child_article_id');
    }

    public function qualificationTags(): BelongsToMany
    {
        return $this->belongsToMany(
            QualificationTag::class,
            'qualification_tag_jalon',
            'jalon_article_id',
            'qualification_tag_id'
        );
    }

    public function jalonProductLinks(): HasMany
    {
        return $this->hasMany(JalonProduct::class, 'jalon_article_id')->orderBy('ordre');
    }

    public function jalonProducts(): BelongsToMany
    {
        return $this->belongsToMany(
            self::class,
            'jalon_products',
            'jalon_article_id',
            'product_article_id'
        )->withPivot(['ordre', 'tache_code', 'tache_label'])->orderByPivot('ordre');
    }

    public function productJalonLinks(): HasMany
    {
        return $this->hasMany(JalonProduct::class, 'product_article_id')->orderBy('ordre');
    }

    public function isJalon(): bool
    {
        return $this->kind === self::KIND_JALON;
    }

    public function isProduct(): bool
    {
        return $this->kind === self::KIND_PRODUCT;
    }
}
