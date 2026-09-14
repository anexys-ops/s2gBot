<?php

namespace App\Http\Controllers\Api;

use App\Models\LabCentreGroup;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class LabCentreGroupController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = LabCentreGroup::query();
        if (! $request->boolean('all')) {
            $query->where('active', true);
        }

        return response()->json($query->orderBy('sort_order')->orderBy('name')->get());
    }

    public function store(Request $request): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'code' => ['required', 'string', 'max:32', Rule::unique('lab_centre_groups', 'code')],
            'name' => 'required|string|max:255',
            'sort_order' => 'nullable|integer|min:0',
            'active' => 'sometimes|boolean',
        ]);

        $centreGroup = LabCentreGroup::create($validated);

        return response()->json($centreGroup, 201);
    }

    public function update(Request $request, LabCentreGroup $labCentreGroup): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'code' => ['sometimes', 'string', 'max:32', Rule::unique('lab_centre_groups', 'code')->ignore($labCentreGroup->id)],
            'name' => 'sometimes|string|max:255',
            'sort_order' => 'nullable|integer|min:0',
            'active' => 'sometimes|boolean',
        ]);

        $labCentreGroup->update($validated);

        return response()->json($labCentreGroup->fresh());
    }

    public function destroy(Request $request, LabCentreGroup $labCentreGroup): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        if ($labCentreGroup->agencies()->exists()) {
            return response()->json(['message' => 'Ce centre est encore rattaché à des agences.'], 422);
        }

        $labCentreGroup->delete();

        return response()->json(null, 204);
    }
}
