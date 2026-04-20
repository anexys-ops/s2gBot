<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class Calibration extends Model
{
    public const RESULT_OK = 'ok';

    public const RESULT_OK_WITH_RESERVE = 'ok_with_reserve';

    public const RESULT_FAILED = 'failed';

    protected $fillable = [
        'equipment_id',
        'calibration_date',
        'next_due_date',
        'certificate_path',
        'provider',
        'result',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'calibration_date' => 'date',
            'next_due_date' => 'date',
        ];
    }

    public function equipment(): BelongsTo
    {
        return $this->belongsTo(Equipment::class);
    }

    public function attachments(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable');
    }
}
