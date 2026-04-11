<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MobileDossierPhoto extends Model
{
    protected $fillable = [
        'dossier_kind',
        'dossier_id',
        'filename',
        'mime_type',
        'captured_at',
        'label',
        'client_upload_id',
        'user_id',
    ];

    protected function casts(): array
    {
        return [
            'captured_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
