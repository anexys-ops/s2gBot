<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ReportFormDefinition extends Model
{
    protected $fillable = ['slug', 'name', 'service_key', 'fields', 'active'];

    protected function casts(): array
    {
        return [
            'fields' => 'array',
            'active' => 'boolean',
        ];
    }
}
