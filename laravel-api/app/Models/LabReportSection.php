<?php

namespace App\Models;

use App\Models\Catalogue\Article;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LabReportSection extends Model
{
    protected $table = 'lab_report_sections';

    protected $fillable = [
        'report_id',
        'sample_id',
        'essai_article_id',
        'technician_id',
        'equipment_id',
        'ordre',
        'performed_at',
        'temperature_c',
        'humidity_pct',
        'data',
        'conformity',
        'conclusion',
    ];

    protected function casts(): array
    {
        return [
            'data'          => 'array',
            'performed_at'  => 'date',
            'temperature_c' => 'decimal:1',
            'humidity_pct'  => 'decimal:1',
            'ordre'         => 'integer',
        ];
    }

    // ── Relations ────────────────────────────────────────────────────────────

    public function report(): BelongsTo
    {
        return $this->belongsTo(LabReport::class);
    }

    public function essaiArticle(): BelongsTo
    {
        return $this->belongsTo(Article::class, 'essai_article_id');
    }

    public function sample(): BelongsTo
    {
        return $this->belongsTo(Sample::class);
    }

    public function technician(): BelongsTo
    {
        return $this->belongsTo(User::class, 'technician_id');
    }

    public function equipment(): BelongsTo
    {
        return $this->belongsTo(Equipment::class);
    }
}
