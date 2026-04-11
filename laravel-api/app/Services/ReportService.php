<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Report;
use App\Models\ReportPdfTemplate;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Storage;

class ReportService
{
    public function generate(Order $order, ?int $templateId = null, ?array $formData = null): Report
    {
        $order->load(['client', 'site', 'orderItems.testType.params', 'orderItems.samples.testResults.testTypeParam']);

        $template = $this->resolveTemplate($templateId);
        $formData = $formData ?? [];

        $filename = 'rapport-'.$order->reference.'-'.now()->format('Y-m-d-His').'.pdf';
        $path = 'reports/'.$filename;

        $report = Report::create([
            'order_id' => $order->id,
            'pdf_template_id' => $template->id,
            'file_path' => $path,
            'filename' => $filename,
            'form_data' => $formData,
            'generated_at' => now(),
            'review_status' => Report::REVIEW_DRAFT,
            'reviewed_at' => null,
            'reviewed_by_user_id' => null,
        ]);

        $this->writePdfToDisk($order, $report, $template->blade_view, $formData);

        return $report->fresh(['pdfTemplate']);
    }

    public function applySignature(Report $report, int $userId, string $signerName, ?string $signatureImageData = null): Report
    {
        $report->update([
            'signed_at' => now(),
            'signed_by_user_id' => $userId,
            'signer_name' => $signerName,
            'signature_image_data' => $signatureImageData,
        ]);

        $report->refresh();
        $order = Order::query()
            ->with(['client', 'site', 'orderItems.testType.params', 'orderItems.samples.testResults.testTypeParam'])
            ->findOrFail($report->order_id);
        $report->load('pdfTemplate');
        $blade = $report->pdfTemplate?->blade_view ?? 'reports.order';
        $this->writePdfToDisk($order, $report, $blade, $report->form_data ?? []);

        return $report->fresh(['pdfTemplate']);
    }

    private function resolveTemplate(?int $templateId): ReportPdfTemplate
    {
        if ($templateId) {
            $t = ReportPdfTemplate::find($templateId);
            if ($t) {
                return $t;
            }
        }

        return ReportPdfTemplate::query()->where('is_default', true)->first()
            ?? ReportPdfTemplate::query()->firstOrFail();
    }

    private function writePdfToDisk(Order $order, Report $report, string $bladeView, array $formData): void
    {
        $report->loadMissing('pdfTemplate');
        $html = view($bladeView, [
            'order' => $order,
            'formData' => $formData,
            'report' => $report,
        ])->render();

        $pdf = Pdf::loadHTML($html);
        $pdf->getDomPDF()->setPaper('A4', 'portrait');
        Storage::disk('local')->put($report->file_path, $pdf->output());
    }
}
