<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Quote extends Model
{
    public const STATUS_DRAFT = 'draft';
    public const STATUS_SENT = 'sent';
    public const STATUS_ACCEPTED = 'accepted';
    public const STATUS_REJECTED = 'rejected';

    protected $fillable = [
        'number',
        'client_id',
        'site_id',
        'quote_date',
        'valid_until',
        'amount_ht',
        'amount_ttc',
        'tva_rate',
        'status',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'quote_date' => 'date',
            'valid_until' => 'date',
            'amount_ht' => 'decimal:2',
            'amount_ttc' => 'decimal:2',
            'tva_rate' => 'decimal:2',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function site(): BelongsTo
    {
        return $this->belongsTo(Site::class);
    }

    public function quoteLines(): HasMany
    {
        return $this->hasMany(QuoteLine::class, 'quote_id');
    }
}
