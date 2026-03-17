<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OrderItem extends Model
{
    protected $fillable = [
        'order_id',
        'test_type_id',
        'quantity',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function testType(): BelongsTo
    {
        return $this->belongsTo(TestType::class, 'test_type_id');
    }

    public function samples(): HasMany
    {
        return $this->hasMany(Sample::class, 'order_item_id');
    }
}
