<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Equipment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class EquipmentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'status' => ['nullable', Rule::in([Equipment::STATUS_ACTIVE, Equipment::STATUS_MAINTENANCE, Equipment::STATUS_RETIRED])],
            'due_within' => 'nullable|integer|min:1|max:365',
        ]);

        $dueWithin = (int) ($validated['due_within'] ?? 0);

        $q = Equipment::query()
            ->with(['agency', 'testTypes:id,name', 'calibrations' => fn ($c) => $c->limit(3)])
            ->orderBy('code');

        if (! empty($validated['status'])) {
            $q->where('status', $validated['status']);
        }

        if ($dueWithin > 0) {
            $until = now()->addDays($dueWithin)->toDateString();
            $q->whereHas('calibrations', function ($cq) use ($until) {
                $cq->whereNotNull('next_due_date')
                    ->whereDate('next_due_date', '<=', $until);
            });
        }

        return response()->json($q->get());
    }

    public function store(Request $request): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $this->validatedPayload($request, null);
        $testTypeIds = $validated['test_type_ids'] ?? [];
        unset($validated['test_type_ids']);

        $equipment = Equipment::create($validated);
        if ($testTypeIds !== []) {
            $equipment->testTypes()->sync($testTypeIds);
        }

        return response()->json($equipment->load(['agency', 'testTypes']), 201);
    }

    public function show(Request $request, Equipment $equipment): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        return response()->json(
            $equipment->load(['agency', 'testTypes', 'calibrations', 'attachments.uploader'])
        );
    }

    public function update(Request $request, Equipment $equipment): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $this->validatedPayload($request, $equipment);
        $testTypeIds = $validated['test_type_ids'] ?? null;
        unset($validated['test_type_ids']);

        $equipment->update(array_filter($validated, fn ($v) => $v !== null));
        if (is_array($testTypeIds)) {
            $equipment->testTypes()->sync($testTypeIds);
        }

        return response()->json($equipment->fresh()->load(['agency', 'testTypes']));
    }

    public function destroy(Request $request, Equipment $equipment): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $equipment->testTypes()->detach();
        $equipment->delete();

        return response()->json(null, 204);
    }

    private function validatedPayload(Request $request, ?Equipment $equipment): array
    {
        $partial = $equipment !== null;
        $codeRule = Rule::unique('equipments', 'code');
        if ($equipment) {
            $codeRule->ignore($equipment->id);
        }

        $rules = [
            'name' => [$partial ? 'sometimes' : 'required', 'string', 'max:255'],
            'code' => [$partial ? 'sometimes' : 'required', 'string', 'max:64', $codeRule],
            'type' => 'nullable|string|max:128',
            'brand' => 'nullable|string|max:128',
            'model' => 'nullable|string|max:128',
            'serial_number' => 'nullable|string|max:128',
            'location' => 'nullable|string|max:255',
            'agency_id' => 'nullable|exists:agencies,id',
            'purchase_date' => 'nullable|date',
            'status' => ['nullable', Rule::in([Equipment::STATUS_ACTIVE, Equipment::STATUS_MAINTENANCE, Equipment::STATUS_RETIRED])],
            'meta' => 'nullable|array',
            'test_type_ids' => 'nullable|array',
            'test_type_ids.*' => 'integer|exists:test_types,id',
        ];

        return $request->validate($rules);
    }
}
