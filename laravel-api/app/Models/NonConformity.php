<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class NonConformity extends Model
{
    public const SEVERITY_MINOR = 'minor';

    public const SEVERITY_MAJOR = 'major';

    public const SEVERITY_CRITICAL = 'critical';

    public const STATUS_OPEN = 'open';

    public const STATUS_ANALYZING = 'analyzing';

    public const STATUS_ACTION = 'action';

    public const STATUS_CLOSED = 'closed';

    protected $fillable = [
        'reference',
        'detected_at',
        'detected_by',
        'sample_id',
        'equipment_id',
        'order_id',
        'severity',
        'description',
        'status',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'detected_at' => 'datetime',
            'meta' => 'array',
        ];
    }

    public function detectedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'detected_by');
    }

    public function sample(): BelongsTo
    {
        return $this->belongsTo(Sample::class);
    }

    public function equipment(): BelongsTo
    {
        return $this->belongsTo(Equipment::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function correctiveActions(): HasMany
    {
        return $this->hasMany(CorrectiveAction::class);
    }
}
