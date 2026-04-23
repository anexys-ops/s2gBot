<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class Quote extends Model
{
    public const STATUS_DRAFT = 'draft';

    public const STATUS_VALIDATED = 'validated';

    public const STATUS_SIGNED = 'signed';

    public const STATUS_SENT = 'sent';

    public const STATUS_RELANCED = 'relanced';

    public const STATUS_LOST = 'lost';

    public const STATUS_INVOICED = 'invoiced';

    /** @deprecated conserver compatibilité anciens jeux de données */
    public const STATUS_ACCEPTED = 'accepted';

    public const STATUS_REJECTED = 'rejected';

    public static function statuses(): array
    {
        return [
            self::STATUS_DRAFT,
            self::STATUS_VALIDATED,
            self::STATUS_SIGNED,
            self::STATUS_SENT,
            self::STATUS_RELANCED,
            self::STATUS_LOST,
            self::STATUS_INVOICED,
            self::STATUS_ACCEPTED,
            self::STATUS_REJECTED,
        ];
    }

    protected $fillable = [
        'number',
        'client_id',
        'contact_id',
        'agency_id',
        'site_id',
        'dossier_id',
        'quote_date',
        'order_date',
        'site_delivery_date',
        'valid_until',
        'amount_ht',
        'amount_ttc',
        'tva_rate',
        'discount_percent',
        'discount_amount',
        'shipping_amount_ht',
        'shipping_tva_rate',
        'travel_fee_ht',
        'travel_fee_tva_rate',
        'billing_address_id',
        'delivery_address_id',
        'pdf_template_id',
        'status',
        'notes',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'quote_date' => 'date',
            'order_date' => 'date',
            'site_delivery_date' => 'date',
            'valid_until' => 'date',
            'amount_ht' => 'decimal:2',
            'amount_ttc' => 'decimal:2',
            'tva_rate' => 'decimal:2',
            'discount_percent' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'shipping_amount_ht' => 'decimal:2',
            'shipping_tva_rate' => 'decimal:2',
            'travel_fee_ht' => 'decimal:2',
            'travel_fee_tva_rate' => 'decimal:2',
            'meta' => 'array',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function clientContact(): BelongsTo
    {
        return $this->belongsTo(ClientContact::class, 'contact_id');
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function site(): BelongsTo
    {
        return $this->belongsTo(Site::class);
    }

    public function dossier(): BelongsTo
    {
        return $this->belongsTo(Dossier::class, 'dossier_id');
    }

    public function billingAddress(): BelongsTo
    {
        return $this->belongsTo(ClientAddress::class, 'billing_address_id');
    }

    public function deliveryAddress(): BelongsTo
    {
        return $this->belongsTo(ClientAddress::class, 'delivery_address_id');
    }

    public function pdfTemplate(): BelongsTo
    {
        return $this->belongsTo(DocumentPdfTemplate::class, 'pdf_template_id');
    }

    public function quoteLines(): HasMany
    {
        return $this->hasMany(QuoteLine::class, 'quote_id');
    }

    public function devisTaches(): HasMany
    {
        return $this->hasMany(DevisTache::class, 'quote_id')->orderBy('ordre');
    }

    public function attachments(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable');
    }
}
