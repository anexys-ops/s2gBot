<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LabCadrage extends Model
{
    protected $table = 'lab_cadrage';

    protected $fillable = [
        'types_essais_demarrage',
        'normes_referentiels',
        'perimetre',
        'tracabilite_iso17025',
        'checklist_done',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'types_essais_demarrage' => 'array',
            'normes_referentiels' => 'array',
            'tracabilite_iso17025' => 'array',
            'checklist_done' => 'array',
        ];
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
