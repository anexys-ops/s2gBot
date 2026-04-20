<?php

namespace App\Observers;

use App\Models\Report;
use App\Models\ReportVersion;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class ReportObserver
{
    public function updating(Report $report): void
    {
        if ($report->signed_at !== null && $report->isDirty('form_data')) {
            throw ValidationException::withMessages([
                'form_data' => ['Le rapport est signé : les données de formulaire ne peuvent plus être modifiées.'],
            ]);
        }

        if (! $report->isDirty(['form_data', 'review_status'])) {
            return;
        }

        $next = (int) (ReportVersion::query()->where('report_id', $report->id)->max('version_number') ?? 0) + 1;

        ReportVersion::query()->create([
            'report_id' => $report->id,
            'version_number' => $next,
            'form_data' => $report->getOriginal('form_data'),
            'review_status' => $report->getOriginal('review_status'),
            'file_path' => $report->getOriginal('file_path'),
            'changed_by' => Auth::id(),
            'change_reason' => null,
            'created_at' => now(),
        ]);
    }
}
