<?php

namespace App\Models\Catalogue;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class ParametreEssai extends Model
{
    use SoftDeletes;

    protected $table = 'ref_parametres_essai';

    protected $fillable = [
        'ref_article_id',
        'code',
        'libelle',
        'unite',
        'valeur_min',
        'valeur_max',
        'ordre',
    ];

    protected function casts(): array
    {
        return [
            'valeur_min' => 'decimal:4',
            'valeur_max' => 'decimal:4',
        ];
    }

    public function article(): BelongsTo
    {
        return $this->belongsTo(Article::class, 'ref_article_id');
    }

    public function scopeOrdonne(Builder $query): Builder
    {
        return $query->orderBy('ordre')->orderBy('code');
    }
}
