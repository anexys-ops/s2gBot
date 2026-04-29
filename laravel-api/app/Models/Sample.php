<?php

namespace App\Models;

use App\Models\Catalogue\Article;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Sample extends Model
{
    use HasFactory;

    // Statuts historiques (rétrocompatibilité)
    public const STATUS_PENDING = 'pending';
    public const STATUS_RECEIVED = 'received';
    public const STATUS_IN_PROGRESS = 'in_progress';
    public const STATUS_TESTED = 'tested';
    public const STATUS_VALIDATED = 'validated';

    // v1.2.0 — flux Réception
    public const STATUS_EN_TRANSIT  = 'en_transit';
    public const STATUS_RECEPTIONNE = 'receptionne';
    public const STATUS_EN_ESSAI    = 'en_essai';
    public const STATUS_TERMINE     = 'termine';
    public const STATUS_REJETE      = 'rejete';

    public const STATUSES_RECEPTION = [
        self::STATUS_EN_TRANSIT,
        self::STATUS_RECEPTIONNE,
        self::STATUS_EN_ESSAI,
        self::STATUS_TERMINE,
        self::STATUS_REJETE,
    ];

    public const TYPES = ['sol', 'eau', 'beton', 'granulat', 'roche', 'enrobe', 'autre'];

    public const CONDITIONS = ['bon', 'endommage', 'insuffisant'];

    protected $fillable = [
        // Historique
        'order_item_id',
        'borehole_id',
        'reference',
        'status',
        'depth_top_m',
        'depth_bottom_m',
        // v1.2.0 réception
        'fold_number',
        'dossier_id',
        'mission_order_id',
        'task_id',
        'product_id',
        'description',
        'sample_type',
        'origin_location',
        'depth_m',
        'collected_by',
        'collected_at',
        'received_by',
        'received_at',
        'condition_state',
        'storage_location',
        'photo_path',
        'weight_g',
        'quantity',
        'rejection_reason',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'received_at'    => 'datetime',
            'collected_at'   => 'datetime',
            'depth_top_m'    => 'decimal:3',
            'depth_bottom_m' => 'decimal:3',
            'depth_m'        => 'decimal:3',
            'weight_g'       => 'decimal:2',
            'quantity'       => 'integer',
        ];
    }

    /**
     * Auto-génère un fold_number 8 chiffres (FOLD-XXXXXXXX) à la création.
     */
    protected static function booted(): void
    {
        static::creating(function (self $sample) {
            if (empty($sample->fold_number)) {
                $sample->fold_number = Sequence::next('FOLD');
            }
        });
    }

    // ── Relations ────────────────────────────────────────────────────────────

    public function orderItem(): BelongsTo
    {
        return $this->belongsTo(OrderItem::class, 'order_item_id');
    }

    public function borehole(): BelongsTo
    {
        return $this->belongsTo(Borehole::class);
    }

    public function dossier(): BelongsTo
    {
        return $this->belongsTo(Dossier::class);
    }

    public function missionOrder(): BelongsTo
    {
        return $this->belongsTo(OrdreMission::class, 'mission_order_id');
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(MissionTask::class, 'task_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Article::class, 'product_id');
    }

    public function collectedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'collected_by');
    }

    public function receivedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by');
    }

    public function testResults(): HasMany
    {
        return $this->hasMany(TestResult::class);
    }

    public function nonConformities(): HasMany
    {
        return $this->hasMany(NonConformity::class);
    }
}
