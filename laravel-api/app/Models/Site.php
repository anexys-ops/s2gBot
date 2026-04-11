<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Site extends Model
{
    use HasFactory;

    protected $fillable = [
        'client_id',
        'name',
        'address',
        'latitude',
        'longitude',
        'reference',
        'travel_fee_quote_ht',
        'travel_fee_invoice_ht',
        'travel_fee_label',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'travel_fee_quote_ht' => 'decimal:2',
            'travel_fee_invoice_ht' => 'decimal:2',
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'meta' => 'array',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    public function missions(): HasMany
    {
        return $this->hasMany(Mission::class);
    }
}
