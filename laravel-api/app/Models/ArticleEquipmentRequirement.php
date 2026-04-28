<?php

namespace App\Models;

use App\Models\Catalogue\Article;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ArticleEquipmentRequirement extends Model
{
    protected $table = 'article_equipment_requirements';

    protected $fillable = [
        'ref_article_id',
        'equipment_id',
        'quantite',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'quantite' => 'integer',
        ];
    }

    public function article(): BelongsTo
    {
        return $this->belongsTo(Article::class, 'ref_article_id');
    }

    public function equipment(): BelongsTo
    {
        return $this->belongsTo(Equipment::class);
    }
}
