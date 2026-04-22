<?php

namespace App\Models\Catalogue;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Tache extends Model
{
    use SoftDeletes;

    protected $table = 'ref_taches';

    protected $fillable = [
        'code',
        'libelle',
        'description',
        'duree_estimee',
        'ressource_type',
    ];

    protected function casts(): array
    {
        return [
            'duree_estimee' => 'integer',
        ];
    }

    public function scopeOrdonne(Builder $query): Builder
    {
        return $query->orderBy('code');
    }
}
