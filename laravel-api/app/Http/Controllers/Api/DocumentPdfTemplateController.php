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

        return response()->json([
            'data' => $query->get()->map(fn (DocumentPdfTemplate $t) => [
                'id' => $t->id,
                'document_type' => $t->document_type,
                'slug' => $t->slug,
                'name' => $t->name,
                'blade_view' => $t->blade_view,
                'is_default' => $t->is_default,
                'layout_config' => AppBranding::mergeLayoutConfig($t->layout_config),
            ]),
        ]);
    }

    public function update(Request $request, DocumentPdfTemplate $documentPdfTemplate): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'is_default' => 'sometimes|boolean',
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

        if (isset($validated['name'])) {
            $documentPdfTemplate->name = $validated['name'];
        }
        if (array_key_exists('layout_config', $validated)) {
            $documentPdfTemplate->layout_config = AppBranding::mergeLayoutConfig($validated['layout_config']);
        }

        $documentPdfTemplate->save();
        $m = $documentPdfTemplate->fresh();

        return response()->json(array_merge($m->toArray(), [
            'layout_config' => AppBranding::mergeLayoutConfig($m->layout_config),
        ]));
    }
}
