<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CommercialOffering extends Model
{
    public const KIND_PRODUCT = 'product';

    public const KIND_SERVICE = 'service';

    protected $fillable = [
        'code',
        'name',
        'description',
        'kind',
        'unit',
        'purchase_price_ht',
        'sale_price_ht',
        'default_tva_rate',
        'stock_quantity',
        'track_stock',
        'active',
    ];

    protected function casts(): array
    {
        return [
            'purchase_price_ht' => 'decimal:2',
            'sale_price_ht' => 'decimal:2',
            'default_tva_rate' => 'decimal:2',
            'stock_quantity' => 'decimal:3',
            'track_stock' => 'boolean',
            'active' => 'boolean',
        ];
    }

    public function quoteLines(): HasMany
    {
        return $this->hasMany(QuoteLine::class, 'commercial_offering_id');
    }
}
