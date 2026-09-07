<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DocumentPdfTemplate;
use App\Support\AppBranding;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** @deprecated Préférer document-pdf-templates?document_type=report */
class ReportPdfTemplateController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        return response()->json([
            'data' => DocumentPdfTemplate::query()
                ->where('document_type', 'report')
                ->orderBy('name')
                ->get()
                ->map(fn (DocumentPdfTemplate $t) => $this->serialize($t)),
        ]);
    }

    public function update(Request $request, int $reportPdfTemplate): JsonResponse
    {
        $template = DocumentPdfTemplate::query()
            ->where('document_type', 'report')
            ->findOrFail($reportPdfTemplate);

        return app(DocumentPdfTemplateController::class)->update($request, $template);
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(DocumentPdfTemplate $t): array
    {
        return [
            'id' => $t->id,
            'slug' => $t->slug,
            'name' => $t->name,
            'blade_view' => $t->blade_view,
            'is_default' => $t->is_default,
            'is_active' => $t->is_active,
            'layout_config' => AppBranding::mergeLayoutConfig($t->layout_config),
        ];
    }
}
