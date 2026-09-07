<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Builder;

/**
 * Agence (tenant opérationnel) rattachée au siège {@see Client}.
 *
 * v1.2.0 — ajout is_siege, active, email, phone + helpers siège.
 */
class Agency extends Model
{
    protected $fillable = [
        'client_id',
        'name',
        'code',
        'is_headquarters',
        'is_siege',
        'active',
        'address',
        'city',
        'postal_code',
        'phone',
        'email',
    ];

    protected function casts(): array
    {
        return [
            'is_headquarters' => 'boolean',
            'is_siege'        => 'boolean',
            'active'          => 'boolean',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'agency_user')->withTimestamps();
    }

    /** Employés labo rattachés via users.agency_id. */
    public function labStaff(): HasMany
    {
        return $this->hasMany(User::class, 'agency_id');
    }

    public function sites(): HasMany
    {
        return $this->hasMany(Site::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    public function quotes(): HasMany
    {
        return $this->hasMany(Quote::class);
    }

    // ── Helpers siège ────────────────────────────────────────────────────────

    public static function siege(): ?self
    {
        return static::where('is_siege', true)->first();
    }

    public static function siegeId(): ?int
    {
        return static::siege()?->id;
    }

    /** Agences internes du laboratoire S2G (sans client_id). */
    public function scopeLab(Builder $query): Builder
    {
        return $query->whereNull('client_id');
    }

    public function isLabAgency(): bool
    {
        return $this->client_id === null;
    }
}
