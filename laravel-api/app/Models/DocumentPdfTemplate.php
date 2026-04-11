<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DocumentPdfTemplate extends Model
{
    protected $fillable = [
        'document_type',
        'slug',
        'name',
        'blade_view',
        'is_default',
    ];

    protected function casts(): array
    {
        return [
            'is_default' => 'boolean',
        ];
    }

    public function quotes(): HasMany
    {
        return $this->hasMany(Quote::class, 'pdf_template_id');
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class, 'pdf_template_id');
    }
}
