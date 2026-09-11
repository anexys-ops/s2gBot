<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class Client extends Model
{
    use HasFactory;

    protected static function booted(): void
    {
        static::created(function (Client $client) {
            if (Agency::query()->where('client_id', $client->id)->where('is_headquarters', true)->exists()) {
                return;
            }
            Agency::query()->create([
                'client_id' => $client->id,
                'name' => $client->name.' — Siège',
                'code' => 'HQ',
                'is_headquarters' => true,
            ]);
        });
    }

    protected $fillable = [
        'name',
        'prolab_code',
        'address',
        'city',
        'country',
        'currency_code',
        'postal_code',
        'email',
        'phone',
        'whatsapp',
        'siret',
        'ice',
        'ca_annuel_tva_regime',
        'rc',
        'patente',
        'if_number',
        'legal_form',
        'cnss_employer',
        'capital_social',
        'meta',
        'portal_modules',
        // Référents S2G
        'commercial_id',
        'responsable_technique_id',
        'responsable_facturation_id',
        'responsable_recouvrement_id',
        // GPS
        'lat',
        'lng',
    ];

    protected function casts(): array
    {
        return [
            'meta'            => 'array',
            'portal_modules'  => 'array',
            'capital_social' => 'decimal:2',
            'ca_annuel_tva_regime' => 'boolean',
            'lat'            => 'float',
            'lng'            => 'float',
        ];
    }

    public function usesCaAnnuelTvaRegime(): bool
    {
        return (bool) $this->ca_annuel_tva_regime;
    }

    // ----------------------------------------------------------------
    // Référents S2G (collaborateurs internes)
    // ----------------------------------------------------------------

    public function commercial(): BelongsTo
    {
        return $this->belongsTo(User::class, 'commercial_id');
    }

    public function responsableTechnique(): BelongsTo
    {
        return $this->belongsTo(User::class, 'responsable_technique_id');
    }

    public function responsableFacturation(): BelongsTo
    {
        return $this->belongsTo(User::class, 'responsable_facturation_id');
    }

    public function responsableRecouvrement(): BelongsTo
    {
        return $this->belongsTo(User::class, 'responsable_recouvrement_id');
    }

    // ----------------------------------------------------------------
    // Relations existantes
    // ----------------------------------------------------------------

    public function addresses(): HasMany
    {
        return $this->hasMany(ClientAddress::class);
    }

    public function contacts(): HasMany
    {
        return $this->hasMany(ClientContact::class);
    }

    public function attachments(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable');
    }

    public function agencies(): HasMany
    {
        return $this->hasMany(Agency::class);
    }

    /** Agences labo S2G autorisées à voir ce client (vide = toutes). */
    public function visibleLabAgencies(): BelongsToMany
    {
        return $this->belongsToMany(Agency::class, 'client_lab_agency')->withTimestamps();
    }

    public function headquartersAgency(): ?Agency
    {
        return $this->agencies()->where('is_headquarters', true)->first();
    }

    public function sites(): HasMany
    {
        return $this->hasMany(Site::class);
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
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

    public function dossiers(): HasMany
    {
        return $this->hasMany(Dossier::class);
    }
}
