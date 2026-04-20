<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Report;
use App\Support\AgencyAccess;
use App\Services\ActivityLogger;
use App\Services\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    public function __construct(
        private ReportService $reportService,
        private ActivityLogger $activityLogger
    ) {}

    public function index(Request $request, Order $order): JsonResponse
    {
        $user = $request->user();
        if (! AgencyAccess::userMayAccessOrder($user, $order)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $reports = $order->reports()
            ->with(['pdfTemplate', 'signedByUser', 'reviewedByUser'])
            ->orderByDesc('generated_at')
            ->get();

        return response()->json($reports);
    }

    public function generate(Request $request, Order $order): JsonResponse
    {
        $user = $request->user();
        if (! AgencyAccess::userMayAccessOrder($user, $order)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        if (! $user->isLab() && ! $user->isClient()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'pdf_template_id' => 'nullable|integer|exists:report_pdf_templates,id',
            'form_data' => 'nullable|array',
        ]);

        $report = $this->reportService->generate(
            $order,
            $validated['pdf_template_id'] ?? null,
            $validated['form_data'] ?? null,
        );

        $this->activityLogger->log($user, 'report.generated', $report, [
            'order_id' => $order->id,
            'filename' => $report->filename,
        ]);

        return response()->json($report->load(['pdfTemplate', 'reviewedByUser']), 201);
    }

    public function sign(Request $request, Report $report): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'signer_name' => 'required|string|max:255',
            'signature_image_data' => 'nullable|string|max:65000',
        ]);

        $updated = $this->reportService->applySignature(
            $report,
            (int) $request->user()->id,
            $validated['signer_name'],
            $validated['signature_image_data'] ?? null,
        );

        $this->activityLogger->log($request->user(), 'report.signed', $updated, [
            'signer_name' => $validated['signer_name'],
        ]);

        return response()->json($updated->load(['pdfTemplate', 'signedByUser', 'reviewedByUser']));
    }

    public function download(Request $request, Report $report): StreamedResponse|JsonResponse
    {
        $order = $report->order;
        $user = $request->user();
        if (! AgencyAccess::userMayAccessOrder($user, $order)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        return $this->reportFileResponse($report);
    }

    public function pdfLink(Request $request, Report $report): JsonResponse
    {
        $order = $report->order;
        if (! AgencyAccess::userMayAccessOrder($request->user(), $order)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $url = URL::temporarySignedRoute(
            'report.pdf.signed',
            now()->addMinutes(15),
            ['report' => $report->id]
        );

        return response()->json(['url' => $url]);
    }

    public function signedPdf(Report $report): StreamedResponse|JsonResponse
    {
        return $this->reportFileResponse($report);
    }

    public function versions(Request $request, Report $report): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        $order = $report->order;
        if (! AgencyAccess::userMayAccessOrder($request->user(), $order)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $data = $report->versions()->with('changedByUser:id,name')->get();

        return response()->json(['data' => $data]);
    }

    private function reportFileResponse(Report $report): StreamedResponse|JsonResponse
    {
        if (! Storage::disk('local')->exists($report->file_path)) {
            return response()->json(['message' => 'Fichier introuvable'], 404);
        }

        return Storage::disk('local')->download(
            $report->file_path,
            $report->filename,
            ['Content-Type' => 'application/pdf']
        );
    }

    public function submitReview(Request $request, Report $report): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        if ($report->review_status !== Report::REVIEW_DRAFT) {
            return response()->json(['message' => 'Seul un rapport en brouillon peut être soumis pour validation.'], 422);
        }

        $report->update(['review_status' => Report::REVIEW_PENDING]);
        $this->activityLogger->log($request->user(), 'report.submitted_for_review', $report->fresh(), [
            'order_id' => $report->order_id,
        ]);

        return response()->json($report->fresh()->load(['pdfTemplate', 'signedByUser', 'reviewedByUser']));
    }

    public function approveReview(Request $request, Report $report): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        if ($report->review_status !== Report::REVIEW_PENDING) {
            return response()->json(['message' => 'Seul un rapport en attente de validation peut être approuvé.'], 422);
        }

        $report->update([
            'review_status' => Report::REVIEW_APPROVED,
            'reviewed_at' => now(),
            'reviewed_by_user_id' => $request->user()->id,
        ]);

        $this->activityLogger->log($request->user(), 'report.approved', $report->fresh(), [
            'order_id' => $report->order_id,
        ]);

        return response()->json($report->fresh()->load(['pdfTemplate', 'signedByUser', 'reviewedByUser']));
    }
}
