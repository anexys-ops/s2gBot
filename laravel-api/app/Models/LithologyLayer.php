<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LithologyLayer extends Model
{
    use HasFactory;

    protected $fillable = [
        'borehole_id',
        'depth_from_m',
        'depth_to_m',
        'description',
        'rqd',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'depth_from_m' => 'decimal:3',
            'depth_to_m' => 'decimal:3',
            'rqd' => 'decimal:2',
            'sort_order' => 'integer',
        ];
    }

    public function borehole(): BelongsTo
    {
        return $this->belongsTo(Borehole::class);
    }
}
