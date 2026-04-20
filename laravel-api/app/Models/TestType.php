<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TestType extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'norm',
        'unit',
        'unit_price',
        'thresholds',
    ];

    protected function casts(): array
    {
        return [
            'unit_price' => 'decimal:2',
            'thresholds' => 'array',
        ];
    }

    public function params(): HasMany
    {
        return $this->hasMany(TestTypeParam::class, 'test_type_id');
    }

    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class, 'test_type_id');
    }

    public function equipments(): BelongsToMany
    {
        return $this->belongsToMany(Equipment::class, 'equipment_test_type')->withTimestamps();
    }
}
