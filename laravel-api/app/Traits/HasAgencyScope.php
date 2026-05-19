<?php

namespace App\Traits;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Schema;

trait HasAgencyScope
{
    public static function bootHasAgencyScope(): void
    {
        // Scope automatique sur les requêtes
        static::addGlobalScope('agency', function (Builder $builder) {
            $user = auth()->user();
            if (! $user) {
                return;
            }

            // Siège (lab_admin ou agency_id null) voit tout
            if ($user->agency_id === null || $user->role === 'lab_admin') {
                return;
            }

            $table = (new static())->getTable();
            if (Schema::hasColumn($table, 'agency_id')) {
                $builder->where($table.'.agency_id', $user->agency_id);
            }
        });

        static::creating(function ($model) {
            if (! isset($model->agency_id) || $model->agency_id === null) {
                $user = auth()->user();
                if ($user && $user->agency_id) {
                    $model->agency_id = $user->agency_id;
                }
            }
        });
    }

    public function agency()
    {
        return $this->belongsTo(\App\Models\Agency::class);
    }

    public function scopeForAgency(Builder $query, int $agencyId): Builder
    {
        return $query->where($this->getTable().'.agency_id', $agencyId);
    }

    public function scopeAllAgencies(Builder $query): Builder
    {
        return $query->withoutGlobalScope('agency');
    }
}
