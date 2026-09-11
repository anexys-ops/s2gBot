<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DocumentStatusDefinition;
use App\Support\DocumentStatusCatalog;
use App\Support\PermissionCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DocumentStatusDefinitionController extends Controller
{
    public function documentTypes(Request $request): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        return response()->json(['data' => DocumentStatusCatalog::documentTypes()]);
    }

    public function index(Request $request): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $query = DocumentStatusDefinition::query()
            ->orderBy('sort_order')
            ->orderBy('label');

        if ($request->filled('document_type')) {
            $query->where('document_type', $request->query('document_type'));
        }

        if ($request->boolean('active_only')) {
            $query->where('active', true);
        }

        return response()->json(['data' => $query->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $this->canConfigure($request)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'document_type' => ['required', Rule::in(DocumentStatusDefinition::documentTypes())],
            'code' => ['required', 'string', 'max:64', 'regex:/^[a-z0-9_]+$/'],
            'label' => 'required|string|max:255',
            'sort_order' => 'nullable|integer|min:0',
            'is_initial' => 'nullable|boolean',
            'is_terminal' => 'nullable|boolean',
            'color_key' => 'nullable|string|max:32',
            'active' => 'nullable|boolean',
        ]);

        $exists = DocumentStatusDefinition::query()
            ->where('document_type', $validated['document_type'])
            ->where('code', $validated['code'])
            ->exists();
        if ($exists) {
            return response()->json(['message' => 'Ce code existe déjà pour ce type de document.'], 422);
        }

        $row = DocumentStatusDefinition::create([
            'document_type' => $validated['document_type'],
            'code' => strtolower($validated['code']),
            'label' => $validated['label'],
            'sort_order' => $validated['sort_order'] ?? 0,
            'is_initial' => $validated['is_initial'] ?? false,
            'is_terminal' => $validated['is_terminal'] ?? false,
            'color_key' => $validated['color_key'] ?? null,
            'active' => $validated['active'] ?? true,
        ]);

        return response()->json($row, 201);
    }

    public function update(Request $request, DocumentStatusDefinition $documentStatusDefinition): JsonResponse
    {
        if (! $this->canConfigure($request)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'label' => 'sometimes|string|max:255',
            'sort_order' => 'nullable|integer|min:0',
            'is_initial' => 'nullable|boolean',
            'is_terminal' => 'nullable|boolean',
            'color_key' => 'nullable|string|max:32',
            'active' => 'nullable|boolean',
        ]);

        $documentStatusDefinition->fill($validated);
        $documentStatusDefinition->save();

        return response()->json($documentStatusDefinition->fresh());
    }

    public function destroy(Request $request, DocumentStatusDefinition $documentStatusDefinition): JsonResponse
    {
        if (! $this->canConfigure($request)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $documentStatusDefinition->delete();

        return response()->json(null, 204);
    }

    private function canConfigure(Request $request): bool
    {
        $u = $request->user();

        return $u->isLabAdmin() || $u->hasCapability(PermissionCatalog::CONFIG_MANAGE);
    }
}
