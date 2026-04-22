<?php

namespace App\Http\Resources\Catalogue;

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
            'code' => $this->code,
            'libelle' => $this->libelle,
            'description' => $this->description,
            'unite' => $this->unite,
            'prix_unitaire_ht' => $this->prix_unitaire_ht,
            'prix_unitaire_ht_formate' => $this->prix_unitaire_ht_formate,
            'tva_rate' => $this->tva_rate,
            'duree_estimee' => $this->duree_estimee,
            'normes' => $this->normes,
            'actif' => $this->actif,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
            'famille' => $this->whenLoaded('famille', fn () => $this->famille),
            'famille_packages' => $this->whenLoaded('famillePackages', function () {
                return $this->famillePackages->map(function ($fp) {
                    $fp->loadMissing('packages');

                    return [
                        'id' => $fp->id,
                        'code' => $fp->code,
                        'libelle' => $fp->libelle,
                        'ordre' => $fp->ordre,
                        'actif' => $fp->actif,
                        'packages' => $fp->packages,
                    ];
                });
            }),
            'parametres_essai' => $this->whenLoaded('parametresEssai', fn () => $this->parametresEssai),
            'resultats' => $this->whenLoaded('resultats', fn () => $this->resultats),
        ];
    }
}
