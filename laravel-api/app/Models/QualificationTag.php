<?php

namespace App\Models;

use App\Models\Catalogue\Article;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class QualificationTag extends Model
{
    protected $fillable = [
        'code',
        'label',
        'groupe',
    ];

    public function jalons(): BelongsToMany
    {
        return $this->belongsToMany(
            Article::class,
            'qualification_tag_jalon',
            'qualification_tag_id',
            'jalon_article_id'
        );
    }

    public function displayLabel(): string
    {
        return preg_replace('/^Qualification\s+/i', '', $this->label) ?? $this->label;
    }
}
