<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EquipmentMaintenancePlan extends Model
{
    public const KIND_ETALONNAGE = 'etalonnage';

    public const KIND_MAINTENANCE = 'maintenance';

    public const KIND_VERIFICATION = 'verification';

    protected $fillable = [
        'equipment_id',
        'label',
        'kind',
        'interval_months',
        'next_due_at',
        'last_performed_at',
        'provider',
        'notes',
        'active',
    ];

    protected function casts(): array
    {
        return [
            'next_due_at' => 'date',
            'last_performed_at' => 'date',
            'active' => 'boolean',
        ];
    }

    public function equipment(): BelongsTo
    {
        return $this->belongsTo(Equipment::class);
    }

    public function calibrations(): HasMany
    {
        return $this->hasMany(Calibration::class, 'maintenance_plan_id');
    }

    /** @return list<string> Dates Y-m-d */
    public function dueDatesInRange(string $from, string $to): array
    {
        if (! $this->active || ! $this->next_due_at) {
            return [];
        }

        $start = Carbon::parse($from)->startOfDay();
        $end = Carbon::parse($to)->endOfDay();
        $current = $this->next_due_at->copy()->startOfDay();
        $interval = max(1, (int) $this->interval_months);

        while ($current->gt($end)) {
            $current->subMonthsNoOverflow($interval);
        }
        while ($current->lt($start)) {
            $current->addMonthsNoOverflow($interval);
        }

        $dates = [];
        while ($current->lte($end)) {
            if ($current->gte($start)) {
                $dates[] = $current->toDateString();
            }
            $current->addMonthsNoOverflow($interval);
        }

        return $dates;
    }

    public function advanceAfterPerformance(Carbon $performedAt): void
    {
        $interval = max(1, (int) $this->interval_months);
        $this->last_performed_at = $performedAt->toDateString();
        $this->next_due_at = $performedAt->copy()->addMonthsNoOverflow($interval)->toDateString();
        $this->save();
    }
}
