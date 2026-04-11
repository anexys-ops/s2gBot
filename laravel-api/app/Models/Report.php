<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Report extends Model
{
    public const REVIEW_DRAFT = 'draft';

    public const REVIEW_PENDING = 'pending_review';

    public const REVIEW_APPROVED = 'approved';

    protected $fillable = [
        'order_id',
        'pdf_template_id',
        'file_path',
        'filename',
        'form_data',
        'signed_at',
        'signed_by_user_id',
        'signer_name',
        'signature_image_data',
        'generated_at',
        'review_status',
        'reviewed_at',
        'reviewed_by_user_id',
    ];

    protected function casts(): array
    {
        return [
            'generated_at' => 'datetime',
            'signed_at' => 'datetime',
            'reviewed_at' => 'datetime',
            'form_data' => 'array',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function pdfTemplate(): BelongsTo
    {
        return $this->belongsTo(ReportPdfTemplate::class, 'pdf_template_id');
    }

    public function signedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'signed_by_user_id');
    }

    public function reviewedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by_user_id');
    }
}
