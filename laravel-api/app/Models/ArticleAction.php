<?php

namespace App\Models;

use App\Models\Catalogue\Article;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ArticleAction extends Model
{
    public const TYPES = ['technicien', 'ingenieur', 'labo'];

    protected $table = 'article_actions';

    protected $fillable = [
        'ref_article_id',
        'type',
        'libelle',
        'description',
        'duree_heures',
        'ordre',
    ];

    protected function casts(): array
    {
        return [
            'duree_heures' => 'integer',
            'ordre' => 'integer',
        ];
    }

    public function article(): BelongsTo
    {
        return $this->belongsTo(Article::class, 'ref_article_id');
    }
}
