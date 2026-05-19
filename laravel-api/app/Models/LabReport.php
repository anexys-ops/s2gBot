<?php

namespace App\Models;

use App\Traits\HasAgencyScope;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LabReport extends Model
{
    use SoftDeletes, HasAgencyScope;

    protected $table = 'lab_reports';

    protected $fillable = [
        'number',
        'bc_id',
        'dossier_id',
        'client_id',
        'site_id',
        'agency_id',
        'technician_id',
        'validator_id',
        'status',
        'title',
        'conclusion',
        'notes_internes',
        'signed_at',
        'emitted_at',
    ];

    protected function casts(): array
    {
        return [
            'signed_at'  => 'datetime',
            'emitted_at' => 'datetime',
        ];
    }

    const STATUSES = ['brouillon', 'en_validation', 'valide', 'signe', 'emis'];

    /** Transitions autorisées : statut courant → statuts suivants possibles. */
    const TRANSITIONS = [
        'brouillon'     => ['en_validation'],
        'en_validation' => ['valide', 'brouillon'],
        'valide'        => ['signe'],
        'signe'         => ['emis'],
        'emis'          => [],
    ];

    // ── Relations ────────────────────────────────────────────────────────────

    public function sections(): HasMany
    {
        return $this->hasMany(LabReportSection::class, 'report_id')->orderBy('ordre');
    }

    public function technician(): BelongsTo
    {
        return $this->belongsTo(User::class, 'technician_id');
    }

    public function validator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'validator_id');
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function bc(): BelongsTo
    {
        return $this->belongsTo(BonCommande::class, 'bc_id');
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
}
