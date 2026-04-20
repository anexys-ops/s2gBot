<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReportVersion extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'report_id',
        'version_number',
        'form_data',
        'review_status',
        'file_path',
        'changed_by',
        'change_reason',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'form_data' => 'array',
            'created_at' => 'datetime',
        ];
    }

    public function report(): BelongsTo
    {
        return $this->belongsTo(Report::class);
    }

    public function changedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}
