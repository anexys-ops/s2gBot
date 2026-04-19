<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ReportPdfTemplate extends Model
{
    protected $fillable = ['slug', 'name', 'blade_view', 'is_default', 'layout_config'];

    protected function casts(): array
    {
        return [
            'is_default' => 'boolean',
            'layout_config' => 'array',
        ];
    }

    public function reports(): HasMany
    {
        return $this->hasMany(Report::class, 'pdf_template_id');
    }
}
