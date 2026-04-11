<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Borehole extends Model
{
    use HasFactory;

    protected $fillable = [
        'mission_id',
        'code',
        'latitude',
        'longitude',
        'ground_level_m',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'ground_level_m' => 'decimal:3',
        ];
    }

    public function mission(): BelongsTo
    {
        return $this->belongsTo(Mission::class);
    }

    public function lithologyLayers(): HasMany
    {
        return $this->hasMany(LithologyLayer::class);
    }

    public function samples(): HasMany
    {
        return $this->hasMany(Sample::class);
    }
}
