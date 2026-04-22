<?php

namespace App\Models;

use App\Models\Catalogue\Article as RefArticle;
use App\Models\Catalogue\Package as RefPackage;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QuoteLine extends Model
{
    protected $fillable = [
        'quote_id',
        'commercial_offering_id',
        'ref_article_id',
        'ref_package_id',
        'type_ligne',
        'line_code',
        'description',
        'quantity',
        'unit_price',
        'tva_rate',
        'discount_percent',
        'total',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'unit_price' => 'decimal:2',
            'tva_rate' => 'decimal:2',
            'discount_percent' => 'decimal:2',
            'total' => 'decimal:2',
        ];
    }

    public function quote(): BelongsTo
    {
        return $this->belongsTo(Quote::class);
    }

    public function commercialOffering(): BelongsTo
    {
        return $this->belongsTo(CommercialOffering::class, 'commercial_offering_id');
    }

    public function refArticle(): BelongsTo
    {
        return $this->belongsTo(RefArticle::class, 'ref_article_id');
    }

    public function refPackage(): BelongsTo
    {
        return $this->belongsTo(RefPackage::class, 'ref_package_id');
    }
}
