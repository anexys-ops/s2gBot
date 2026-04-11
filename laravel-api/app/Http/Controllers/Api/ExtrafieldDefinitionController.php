<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ExtrafieldDefinition;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ExtrafieldDefinitionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $query = ExtrafieldDefinition::query()->orderBy('sort_order')->orderBy('label');
        if ($request->filled('entity_type')) {
            $query->where('entity_type', $request->query('entity_type'));
        }

        return response()->json(['data' => $query->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'entity_type' => ['required', Rule::in(ExtrafieldDefinition::entityTypes())],
            'code' => ['required', 'string', 'max:64', 'regex:/^[a-z0-9_]+$/'],
            'label' => 'required|string|max:255',
            'field_type' => ['required', Rule::in(ExtrafieldDefinition::fieldTypes())],
            'select_options' => 'nullable|array',
            'select_options.*.value' => 'required_with:select_options|string|max:255',
            'select_options.*.label' => 'required_with:select_options|string|max:255',
            'sort_order' => 'nullable|integer|min:0',
            'required' => 'nullable|boolean',
        ]);

        if ($validated['field_type'] === 'select' && empty($validated['select_options'])) {
            return response()->json(['message' => 'Les champs de type liste nécessitent des options.'], 422);
        }

        $exists = ExtrafieldDefinition::query()
            ->where('entity_type', $validated['entity_type'])
            ->where('code', $validated['code'])
            ->exists();
        if ($exists) {
            return response()->json(['message' => 'Ce code existe déjà pour ce type d\'entité.'], 422);
        }

        $row = ExtrafieldDefinition::create([
            'entity_type' => $validated['entity_type'],
            'code' => strtolower($validated['code']),
            'label' => $validated['label'],
            'field_type' => $validated['field_type'],
            'select_options' => $validated['select_options'] ?? null,
            'sort_order' => $validated['sort_order'] ?? 0,
            'required' => $validated['required'] ?? false,
        ]);

        return response()->json($row, 201);
    }

    public function update(Request $request, ExtrafieldDefinition $extrafieldDefinition): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'label' => 'sometimes|string|max:255',
            'field_type' => ['sometimes', Rule::in(ExtrafieldDefinition::fieldTypes())],
            'select_options' => 'nullable|array',
            'select_options.*.value' => 'required_with:select_options|string|max:255',
            'select_options.*.label' => 'required_with:select_options|string|max:255',
            'sort_order' => 'nullable|integer|min:0',
            'required' => 'nullable|boolean',
        ]);

        $fieldType = $validated['field_type'] ?? $extrafieldDefinition->field_type;
        $options = array_key_exists('select_options', $validated)
            ? $validated['select_options']
            : $extrafieldDefinition->select_options;
        if ($fieldType === 'select' && empty($options)) {
            return response()->json(['message' => 'Les champs de type liste nécessitent des options.'], 422);
        }

        $extrafieldDefinition->fill($validated);
        $extrafieldDefinition->save();

        return response()->json($extrafieldDefinition->fresh());
    }

    public function destroy(Request $request, ExtrafieldDefinition $extrafieldDefinition): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $extrafieldDefinition->delete();

        return response()->json(null, 204);
    }
}
