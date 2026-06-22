<?php

namespace App\Http\Resources\Catalogue;

use App\Models\Catalogue\Article;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ArticleResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'ref_famille_article_id' => $this->ref_famille_article_id,
            'ref_article_lie_id' => $this->ref_article_lie_id,
            'code' => $this->code,
            'code_interne' => $this->code_interne,
            'sku' => $this->sku,
            'libelle' => $this->libelle,
            'description' => $this->description,
            'description_commerciale' => $this->description_commerciale,
            'description_technique' => $this->description_technique,
            'tags' => ($this->resource->isJalon() || $this->resource->isProduct()) ? null : $this->tags,
            'unite' => $this->unite,
            'hfsql_unite' => $this->hfsql_unite,
            'prix_unitaire_ht' => $this->prix_unitaire_ht,
            'prix_revient_ht' => $this->prix_revient_ht,
            'prix_unitaire_ht_formate' => $this->prix_unitaire_ht_formate,
            'tva_rate' => $this->tva_rate,
            'duree_estimee' => $this->duree_estimee,
            'normes' => $this->normes,
            'actif' => $this->actif,
            'kind' => $this->kind ?? Article::KIND_LEGACY,
            'famille_label' => $this->famille_label,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
            'famille' => $this->whenLoaded('famille', fn () => $this->famille),
            'article_lie' => $this->whenLoaded('articleLie', fn () => $this->articleLie ? [
                'id' => $this->articleLie->id,
                'code' => $this->articleLie->code,
                'libelle' => $this->articleLie->libelle,
            ] : null),
            'famille_packages' => $this->whenLoaded('famillePackages', function () {
                return $this->famillePackages->map(function ($fp) {
                    $fp->loadMissing('packages');

                    return [
                        'id' => $fp->id,
                        'code' => $fp->code,
                        'libelle' => $fp->libelle,
                        'description' => $fp->description,
                        'ordre' => $fp->ordre,
                        'actif' => $fp->actif,
                        'packages' => $fp->packages,
                    ];
                });
            }),
            'parametres_essai' => $this->whenLoaded('parametresEssai', fn () => $this->parametresEssai),
            'resultats' => $this->whenLoaded('resultats', fn () => $this->resultats),
            'qualification_tags' => $this->whenLoaded('qualificationTags', fn () => $this->qualificationTags->map(fn ($tag) => [
                'id' => $tag->id,
                'code' => $tag->code,
                'label' => $tag->label,
                'display_label' => $tag->displayLabel(),
                'groupe' => $tag->groupe,
            ])),
            'jalon_products' => $this->whenLoaded('jalonProductLinks', fn () => $this->jalonProductLinks->map(fn ($link) => [
                'id' => $link->id,
                'ordre' => $link->ordre,
                'tache_code' => $link->tache_code,
                'tache_label' => $link->tache_label,
                'product' => $link->product ? [
                    'id' => $link->product->id,
                    'code' => $link->product->code,
                    'libelle' => $link->product->libelle,
                    'unite' => $link->product->unite,
                    'prix_unitaire_ht' => $link->product->prix_unitaire_ht,
                    'tva_rate' => $link->product->tva_rate,
                    'kind' => $link->product->kind,
                    'actif' => $link->product->actif,
                ] : null,
            ])),
            'product_jalons' => $this->whenLoaded('productJalonLinks', fn () => $this->productJalonLinks->map(fn ($link) => [
                'id' => $link->id,
                'ordre' => $link->ordre,
                'jalon' => $link->jalon ? [
                    'id' => $link->jalon->id,
                    'code' => $link->jalon->code,
                    'libelle' => $link->jalon->libelle,
                    'famille_label' => $link->jalon->famille_label,
                    'kind' => $link->jalon->kind,
                    'actif' => $link->jalon->actif,
                ] : null,
            ])),
        ];
    }
}
