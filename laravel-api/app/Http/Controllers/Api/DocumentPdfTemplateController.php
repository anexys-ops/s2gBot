<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DocumentPdfTemplate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

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

        return response()->json(['data' => $query->get()]);
    }

    public function update(Request $request, DocumentPdfTemplate $documentPdfTemplate): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'is_default' => 'sometimes|boolean',
            'name' => 'sometimes|string|max:255',
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

        $documentPdfTemplate->save();

        return response()->json($documentPdfTemplate->fresh());
    }
}
