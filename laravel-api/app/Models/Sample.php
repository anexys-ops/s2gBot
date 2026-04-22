<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Sample extends Model
{
    use HasFactory;

    public const STATUS_PENDING = 'pending';
    public const STATUS_RECEIVED = 'received';
    public const STATUS_IN_PROGRESS = 'in_progress';
    public const STATUS_TESTED = 'tested';
    public const STATUS_VALIDATED = 'validated';

    protected $fillable = [
        'order_item_id',
        'borehole_id',
        'reference',
        'received_at',
        'status',
        'notes',
        'depth_top_m',
        'depth_bottom_m',
    ];

    protected function casts(): array
    {
        return [
            'received_at' => 'date',
            'depth_top_m' => 'decimal:3',
            'depth_bottom_m' => 'decimal:3',
        ];
    }

    public function orderItem(): BelongsTo
    {
        return $this->belongsTo(OrderItem::class, 'order_item_id');
    }

    public function borehole(): BelongsTo
    {
        return $this->belongsTo(Borehole::class);
    }

    public function testResults(): HasMany
    {
        return $this->hasMany(TestResult::class);
    }

    public function nonConformities(): HasMany
    {
        return $this->hasMany(NonConformity::class);
    }
}
