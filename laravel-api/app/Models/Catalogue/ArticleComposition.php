<?php

namespace App\Models\Catalogue;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ArticleComposition extends Model
{
    protected $table = 'article_compositions';

    protected $fillable = [
        'parent_article_id',
        'child_article_id',
        'qty_per_unit',
        'is_optional',
        'ordre',
    ];

    protected function casts(): array
    {
        return [
            'qty_per_unit' => 'integer',
            'is_optional'  => 'boolean',
            'ordre'        => 'integer',
        ];
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(Article::class, 'parent_article_id');
    }

    public function child(): BelongsTo
    {
        return $this->belongsTo(Article::class, 'child_article_id');
    }
}
