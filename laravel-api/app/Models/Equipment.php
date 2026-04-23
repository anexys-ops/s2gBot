<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class Equipment extends Model
{
    protected $table = 'equipments';

    public const STATUS_ACTIVE = 'active';

    public const STATUS_MAINTENANCE = 'maintenance';

    public const STATUS_RETIRED = 'retired';

    protected $fillable = [
        'name',
        'code',
        'type',
        'brand',
        'model',
        'serial_number',
        'location',
        'agency_id',
        'purchase_date',
        'status',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'purchase_date' => 'date',
            'meta' => 'array',
        ];
    }

    public function agency(): BelongsTo
    {
        return $this->belongsTo(Agency::class);
    }

    public function calibrations(): HasMany
    {
        return $this->hasMany(Calibration::class)->orderByDesc('calibration_date');
    }

    public function testTypes(): BelongsToMany
    {
        return $this->belongsToMany(TestType::class, 'equipment_test_type')->withTimestamps();
    }

    public function attachments(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable');
    }

    public function nonConformities(): HasMany
    {
        return $this->hasMany(NonConformity::class);
    }

    public function commercialOfferings(): HasMany
    {
        return $this->hasMany(CommercialOffering::class, 'equipment_id');
    }
}
