<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class Invoice extends Model
{
    public const STATUS_DRAFT = 'draft';

    public const STATUS_VALIDATED = 'validated';

    public const STATUS_SIGNED = 'signed';

    public const STATUS_SENT = 'sent';

    public const STATUS_RELANCED = 'relanced';

    public const STATUS_PAID = 'paid';

    public static function statuses(): array
    {
        return [
            self::STATUS_DRAFT,
            self::STATUS_VALIDATED,
            self::STATUS_SIGNED,
            self::STATUS_SENT,
            self::STATUS_RELANCED,
            self::STATUS_PAID,
        ];
    }

    protected $fillable = [
        'number',
        'client_id',
        'invoice_date',
        'order_date',
        'site_delivery_date',
        'due_date',
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
    ];

    protected function casts(): array
    {
        return [
            'invoice_date' => 'date',
            'order_date' => 'date',
            'site_delivery_date' => 'date',
            'due_date' => 'date',
            'amount_ht' => 'decimal:2',
            'amount_ttc' => 'decimal:2',
            'tva_rate' => 'decimal:2',
            'discount_percent' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'shipping_amount_ht' => 'decimal:2',
            'shipping_tva_rate' => 'decimal:2',
            'travel_fee_ht' => 'decimal:2',
            'travel_fee_tva_rate' => 'decimal:2',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
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

    public function orders(): BelongsToMany
    {
        return $this->belongsToMany(Order::class, 'invoice_orders')->withTimestamps();
    }

    public function invoiceLines(): HasMany
    {
        return $this->hasMany(InvoiceLine::class, 'invoice_id');
    }

    public function attachments(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable');
    }
}
