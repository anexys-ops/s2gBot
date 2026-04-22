<?php

namespace App\Models\Catalogue;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Package extends Model
{
    use SoftDeletes;

    protected $table = 'ref_packages';

    protected $fillable = [
        'ref_famille_package_id',
        'code',
        'libelle',
        'description',
        'prix_ht',
        'tva_rate',
        'actif',
    ];

    protected $appends = [
        'prix_ht_formate',
    ];

    protected function casts(): array
    {
        return [
            'prix_ht' => 'decimal:2',
            'tva_rate' => 'decimal:2',
            'actif' => 'boolean',
        ];
    }

    protected function prixHtFormate(): Attribute
    {
        return Attribute::get(function (): string {
            return number_format((float) $this->prix_ht, 2, ',', ' ').' € HT';
        });
    }

    public function famillePackage(): BelongsTo
    {
        return $this->belongsTo(FamillePackage::class, 'ref_famille_package_id');
    }

    public function scopeActif(Builder $query): Builder
    {
        return $query->where('actif', true);
    }

    public function scopeOrdonne(Builder $query): Builder
    {
        return $query->orderBy('code');
    }
}
