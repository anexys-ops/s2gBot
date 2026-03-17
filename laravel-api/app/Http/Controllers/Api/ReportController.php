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

        $reports = $order->reports()->orderByDesc('generated_at')->get();

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

        $report = $this->reportService->generate($order);

        return response()->json($report, 201);
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
