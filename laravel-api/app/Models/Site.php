<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class Site extends Model
{
    use HasFactory;

    /** Statuts chantier (workflow terrain / livraison). */
    public const STATUSES = [
        'not_started',
        'in_progress',
        'blocked',
        'delivered',
        'archived',
    ];

    protected $fillable = [
        'client_id',
        'agency_id',
        'name',
        'address',
        'latitude',
        'longitude',
        'reference',
        'status',
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

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
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

    public function attachments(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable');
    }
}
