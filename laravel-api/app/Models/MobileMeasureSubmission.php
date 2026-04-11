<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MobileMeasureSubmission extends Model
{
    protected $fillable = [
        'dossier_kind',
        'dossier_id',
        'form_template_id',
        'client_submission_id',
        'submitted_at',
        'values',
        'user_id',
    ];

    protected function casts(): array
    {
        return [
            'submitted_at' => 'datetime',
            'values' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
