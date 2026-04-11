<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClientAddress extends Model
{
    public const TYPE_BILLING = 'billing';

    public const TYPE_DELIVERY = 'delivery';

    public const TYPE_SITE = 'site';

    public const TYPE_HEADQUARTERS = 'headquarters';

    protected $fillable = [
        'client_id',
        'type',
        'label',
        'line1',
        'line2',
        'postal_code',
        'city',
        'country',
        'is_default',
    ];

    protected function casts(): array
    {
        return [
            'is_default' => 'boolean',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function labelFormatted(): string
    {
        $parts = array_filter([
            $this->line1,
            $this->line2,
            trim(($this->postal_code ?? '').' '.($this->city ?? '')),
            $this->country !== 'FR' ? $this->country : null,
        ]);

        return implode(', ', $parts);
    }
}
