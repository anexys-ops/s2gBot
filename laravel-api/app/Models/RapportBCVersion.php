<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RapportBCVersion extends Model
{
    protected $table = 'rapport_bc_versions';

    public $timestamps = false;

    protected $fillable = [
        'rapport_bc_id',
        'version_number',
        'file_path',
        'original_filename',
        'file_hash',
        'file_size',
        'uploaded_by',
        'upload_notes',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
            'file_size' => 'integer',
            'version_number' => 'integer',
        ];
    }

    public function rapportBC(): BelongsTo
    {
        return $this->belongsTo(RapportBC::class, 'rapport_bc_id');
    }

    public function uploadedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
