<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class OrdreMission extends Model
{
    use SoftDeletes;

    public const TYPE_LABO        = 'labo';
    public const TYPE_TECHNICIEN  = 'technicien';
    public const TYPE_INGENIEUR   = 'ingenieur';

    public const STATUT_BROUILLON = 'brouillon';
    public const STATUT_PLANIFIE  = 'planifie';
    public const STATUT_EN_COURS  = 'en_cours';
    public const STATUT_TERMINE   = 'termine';
    public const STATUT_ANNULE    = 'annule';

    protected $table = 'ordres_mission';

    protected $fillable = [
        'numero',
        'bon_commande_id',
        'dossier_id',
        'client_id',
        'site_id',
        'type',
        'statut',
        'date_prevue',
        'date_debut',
        'date_fin',
        'responsable_id',
        'notes',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'date_prevue' => 'date',
            'date_debut'  => 'date',
            'date_fin'    => 'date',
        ];
    }

    public function bonCommande(): BelongsTo
    {
        return $this->belongsTo(BonCommande::class, 'bon_commande_id');
    }

    public function dossier(): BelongsTo
    {
        return $this->belongsTo(Dossier::class);
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function site(): BelongsTo
    {
        return $this->belongsTo(Site::class);
    }

    public function responsable(): BelongsTo
    {
        return $this->belongsTo(User::class, 'responsable_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function lignes(): HasMany
    {
        return $this->hasMany(OrdreMissionLigne::class, 'ordre_mission_id')->orderBy('ordre');
    }

    public function fraisDeplacement(): HasMany
    {
        return $this->hasMany(FraisDeplacement::class, 'ordre_mission_id');
    }

    /** Génère le prochain numéro séquentiel */
    public static function nextNumero(string $type): string
    {
        $prefix = match ($type) {
            self::TYPE_LABO       => 'OM-L',
            self::TYPE_TECHNICIEN => 'OM-T',
            self::TYPE_INGENIEUR  => 'OM-I',
            default               => 'OM',
        };
        $year = now()->format('Y');
        $last = self::withTrashed()
            ->where('numero', 'like', "{$prefix}-{$year}-%")
            ->orderByDesc('id')
            ->value('numero');

        $seq = $last ? ((int) substr($last, strrpos($last, '-') + 1)) + 1 : 1;

        return sprintf('%s-%s-%04d', $prefix, $year, $seq);
    }
}
