<?php

namespace App\Models;

use App\Models\ModuleSetting;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RapportBC extends Model
{
    protected $table = 'rapport_bcs';

    public const STATUT_BROUILLON    = 'brouillon';
    public const STATUT_PRELIMINAIRE = 'preliminaire';
    public const STATUT_VALIDE       = 'valide';
    public const STATUT_ARCHIVE      = 'archive';

    public const DEFAULT_STATUTS = [
        self::STATUT_BROUILLON,
        self::STATUT_PRELIMINAIRE,
        self::STATUT_VALIDE,
        self::STATUT_ARCHIVE,
    ];

    protected $fillable = [
        'numero',
        'titre',
        'statut',
        'bon_commande_id',
        'created_by',
        'notes',
    ];

    public static function nextNumero(): string
    {
        $year = now()->year;
        $prefix = "RAP-{$year}-";
        $last = static::query()
            ->where('numero', 'like', "{$prefix}%")
            ->orderByDesc('numero')
            ->value('numero');
        $seq = $last ? ((int) substr($last, strlen($prefix))) + 1 : 1;
        return $prefix . str_pad($seq, 4, '0', STR_PAD_LEFT);
    }

    /** Statuts configurables (défauts si non configurés). */
    public static function getStatuts(): array
    {
        $settings = ModuleSetting::query()->where('module_key', 'rapport_bc')->value('settings') ?? [];
        $statuts = $settings['statuts'] ?? null;
        return (is_array($statuts) && count($statuts) > 0) ? $statuts : self::DEFAULT_STATUTS;
    }

    public function bonCommande(): BelongsTo
    {
        return $this->belongsTo(BonCommande::class, 'bon_commande_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function versions(): HasMany
    {
        return $this->hasMany(RapportBCVersion::class, 'rapport_bc_id')->orderByDesc('version_number');
    }

    public function suivis(): HasMany { return $this->hasMany(RapportBCSuivi::class, 'rapport_bc_id')->latest('created_at'); }

    public function taches(): BelongsToMany
    {
        return $this->belongsToMany(MissionTask::class, 'rapport_bc_taches', 'rapport_bc_id', 'mission_task_id');
    }
}
