<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LabCentreGroup extends Model
{
    protected $fillable = [
        'code',
        'name',
        'sort_order',
        'active',
    ];

    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
            'active' => 'boolean',
        ];
    }

    public function agencies(): HasMany
    {
        return $this->hasMany(Agency::class)->orderByDesc('is_siege')->orderBy('name');
    }

    public function labAgencies(): HasMany
    {
        return $this->agencies()->whereNull('client_id');
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'lab_centre_group_user')->withTimestamps();
    }
}
