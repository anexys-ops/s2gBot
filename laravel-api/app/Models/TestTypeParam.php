<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TestTypeParam extends Model
{
    protected $fillable = [
        'test_type_id',
        'name',
        'unit',
        'expected_type',
    ];

    public function testType(): BelongsTo
    {
        return $this->belongsTo(TestType::class, 'test_type_id');
    }

    public function testResults(): HasMany
    {
        return $this->hasMany(TestResult::class, 'test_type_param_id');
    }
}
