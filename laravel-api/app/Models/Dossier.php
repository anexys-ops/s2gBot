<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;

class Dossier extends Model
{
    use SoftDeletes;

    public const STATUT_BROUILLON = 'brouillon';

    public const STATUT_EN_COURS = 'en_cours';

    public const STATUT_CLOTURE = 'cloture';

    public const STATUT_ARCHIVE = 'archive';

    /**
     * @return list<string>
     */
    public static function statuts(): array
    {
        return [
            self::STATUT_BROUILLON,
            self::STATUT_EN_COURS,
            self::STATUT_CLOTURE,
            self::STATUT_ARCHIVE,
        ];
    }

    protected $fillable = [
        'reference',
        'titre',
        'client_id',
        'site_id',
        'mission_id',
        'statut',
        'date_debut',
        'date_fin_prevue',
        'maitre_ouvrage',
        'entreprise_chantier',
        'notes',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'date_debut' => 'date',
            'date_fin_prevue' => 'date',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Dossier $dossier) {
            if (empty($dossier->reference)) {
                $dossier->reference = $dossier->newReference();
            }
        });
    }

    public function newReference(): string
    {
        $year = (int) now()->format('Y');
        $prefix = 'DOS-'.$year.'-';

        return DB::transaction(function () use ($prefix) {
            $last = static::query()
                ->where('reference', 'like', $prefix.'%')
                ->lockForUpdate()
                ->orderByDesc('reference')
                ->value('reference');

            $n = 1;
            if (is_string($last) && preg_match('/^DOS-\d{4}-(\d{1,4})$/', $last, $m)) {
                $n = (int) $m[1] + 1;
            }

            return $prefix.str_pad((string) $n, 4, '0', STR_PAD_LEFT);
        });
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function site(): BelongsTo
    {
        return $this->belongsTo(Site::class);
    }

    public function mission(): BelongsTo
    {
        return $this->belongsTo(Mission::class);
    }

    public function createur(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function contacts(): HasMany
    {
        return $this->hasMany(DossierContact::class);
    }

    public function missions(): HasMany
    {
        return $this->hasMany(Mission::class, 'dossier_id');
    }

    public function quotes(): HasMany
    {
        return $this->hasMany(Quote::class, 'dossier_id');
    }

    public function bonsCommande(): HasMany
    {
        return $this->hasMany(BonCommande::class, 'dossier_id');
    }

    public function bonsLivraison(): HasMany
    {
        return $this->hasMany(BonLivraison::class, 'dossier_id');
    }

    public function attachments(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable');
    }

    public function scopeOrdonne(Builder $query): Builder
    {
        return $query->orderByDesc('date_debut')->orderBy('reference');
    }
}
