<?php

namespace App\Models;

use App\Models\Catalogue\Article;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ArticleSectionProduct extends Model
{
    public const SECTION_TECHNICIEN = 'technicien';

    public const SECTION_INGENIEUR = 'ingenieur';

    public const SECTION_LABO = 'labo';

    public const SECTIONS = [
        self::SECTION_TECHNICIEN,
        self::SECTION_INGENIEUR,
        self::SECTION_LABO,
    ];

    protected $fillable = [
        'ref_article_id',
        'product_article_id',
        'section_type',
        'ordre',
    ];

    protected function casts(): array
    {
        return [
            'ordre' => 'integer',
        ];
    }

    public function ownerArticle(): BelongsTo
    {
        return $this->belongsTo(Article::class, 'ref_article_id');
    }

    public function productArticle(): BelongsTo
    {
        return $this->belongsTo(Article::class, 'product_article_id');
    }
}
