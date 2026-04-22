<?php

namespace App\Models\Catalogue;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Resultat extends Model
{
    protected $table = 'ref_resultats';

    protected $fillable = [
        'ref_article_id',
        'code',
        'libelle',
        'norme',
        'valeur_seuil',
    ];

    protected function casts(): array
    {
        return [
            'valeur_seuil' => 'decimal:4',
        ];
    }

    public function article(): BelongsTo
    {
        return $this->belongsTo(Article::class, 'ref_article_id');
    }
}
