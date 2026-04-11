<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Report;
use App\Services\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    public function __construct(
        private ReportService $reportService
    ) {}

    public function index(Request $request, Order $order): JsonResponse
    {
        $user = $request->user();
        if ($user->isClient() && $order->client_id !== $user->client_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        if ($user->isSiteContact() && $order->client_id !== $user->client_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $reports = $order->reports()
            ->with(['pdfTemplate', 'signedByUser'])
            ->orderByDesc('generated_at')
            ->get();

        return response()->json($reports);
    }

    public function generate(Request $request, Order $order): JsonResponse
    {
        $user = $request->user();
        if ($user->isClient() && $order->client_id !== $user->client_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        if ($user->isSiteContact() && $order->client_id !== $user->client_id) {
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

        return response()->json($report->load('pdfTemplate'), 201);
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

        return response()->json($updated->load(['pdfTemplate', 'signedByUser']));
    }

    public function download(Request $request, Report $report): StreamedResponse|JsonResponse
    {
        $order = $report->order;
        $user = $request->user();
        if ($user->isClient() && $order->client_id !== $user->client_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        if ($user->isSiteContact() && $order->client_id !== $user->client_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        if (! Storage::disk('local')->exists($report->file_path)) {
            return response()->json(['message' => 'Fichier introuvable'], 404);
        }

        return Storage::disk('local')->download(
            $report->file_path,
            $report->filename,
            ['Content-Type' => 'application/pdf']
        );
    }
}
