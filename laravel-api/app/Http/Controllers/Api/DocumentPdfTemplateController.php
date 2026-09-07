<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DocumentPdfTemplate;
use App\Support\AppBranding;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DocumentPdfTemplateController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $query = DocumentPdfTemplate::query()->orderBy('document_type')->orderBy('name');
        if ($request->filled('document_type')) {
            $query->where('document_type', $request->query('document_type'));
        }
        if ($request->boolean('active_only')) {
            $query->where('is_active', true);
        }

        return response()->json([
            'data' => $query->get()->map(fn (DocumentPdfTemplate $t) => $this->serializeTemplate($t)),
        ]);
    }

    public function show(Request $request, DocumentPdfTemplate $documentPdfTemplate): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        return response()->json($this->serializeTemplate($documentPdfTemplate));
    }

    public function update(Request $request, DocumentPdfTemplate $documentPdfTemplate): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'is_default' => 'sometimes|boolean',
            'is_active' => 'sometimes|boolean',
            'name' => 'sometimes|string|max:255',
            'layout_config' => 'sometimes|array',
        ]);

        if (array_key_exists('is_default', $validated) && $validated['is_default']) {
            DocumentPdfTemplate::query()
                ->where('document_type', $documentPdfTemplate->document_type)
                ->where('id', '!=', $documentPdfTemplate->id)
                ->update(['is_default' => false]);
            $documentPdfTemplate->is_default = true;
        }

        if (array_key_exists('is_active', $validated)) {
            if (! $validated['is_active'] && $documentPdfTemplate->is_default) {
                return response()->json([
                    'message' => 'Impossible de désactiver le modèle par défaut. Choisissez d’abord un autre modèle par défaut.',
                ], 422);
            }
            $documentPdfTemplate->is_active = $validated['is_active'];
        }

        if (isset($validated['name'])) {
            $documentPdfTemplate->name = $validated['name'];
        }
        if (array_key_exists('layout_config', $validated)) {
            $documentPdfTemplate->layout_config = AppBranding::mergeLayoutConfig($validated['layout_config']);
        }

        $documentPdfTemplate->save();

        return response()->json($this->serializeTemplate($documentPdfTemplate->fresh()));
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeTemplate(DocumentPdfTemplate $t): array
    {
        return [
            'id' => $t->id,
            'document_type' => $t->document_type,
            'slug' => $t->slug,
            'name' => $t->name,
            'blade_view' => $t->blade_view,
            'is_default' => $t->is_default,
            'is_active' => $t->is_active,
            'layout_config' => AppBranding::mergeLayoutConfig($t->layout_config),
        ];
    }
}
