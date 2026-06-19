<?php

namespace App\Models;

use App\Models\Catalogue\Article;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class JalonProduct extends Model
{
    protected $fillable = [
        'jalon_article_id',
        'product_article_id',
        'ordre',
        'tache_code',
        'tache_label',
    ];

    protected function casts(): array
    {
        return [
            'ordre' => 'integer',
        ];
    }

    public function jalon(): BelongsTo
    {
        return $this->belongsTo(Article::class, 'jalon_article_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Article::class, 'product_article_id');
    }
}
