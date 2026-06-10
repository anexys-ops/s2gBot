<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Calibration;
use App\Models\Equipment;
use App\Models\EquipmentMaintenancePlan;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class EquipmentMaintenancePlanController extends Controller
{
    public function dueInRange(Request $request): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'from' => 'required|date',
            'to' => 'required|date|after_or_equal:from',
            'equipment_id' => 'nullable|integer|exists:equipments,id',
        ]);

        $q = EquipmentMaintenancePlan::query()
            ->where('active', true)
            ->with(['equipment:id,code,name']);

        if (! empty($validated['equipment_id'])) {
            $q->where('equipment_id', $validated['equipment_id']);
        }

        $events = [];
        foreach ($q->get() as $plan) {
            foreach ($plan->dueDatesInRange($validated['from'], $validated['to']) as $date) {
                $events[] = [
                    'plan_id' => $plan->id,
                    'equipment_id' => $plan->equipment_id,
                    'date' => $date,
                    'label' => $plan->label,
                    'kind' => $plan->kind,
                    'interval_months' => $plan->interval_months,
                    'equipment' => $plan->equipment,
                ];
            }
        }

        usort($events, fn ($a, $b) => [$a['date'], $a['equipment_id']] <=> [$b['date'], $b['equipment_id']]);

        return response()->json($events);
    }

    public function index(Request $request, Equipment $equipment): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        return response()->json(
            $equipment->maintenancePlans()->orderBy('next_due_at')->get()
        );
    }

    public function store(Request $request, Equipment $equipment): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $this->validatedPayload($request);
        $plan = $equipment->maintenancePlans()->create($validated);

        return response()->json($plan, 201);
    }

    public function update(Request $request, Equipment $equipment, EquipmentMaintenancePlan $plan): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        $this->assertPlanBelongsToEquipment($plan, $equipment);

        $plan->update($this->validatedPayload($request, true));

        return response()->json($plan->fresh());
    }

    public function destroy(Request $request, Equipment $equipment, EquipmentMaintenancePlan $plan): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        $this->assertPlanBelongsToEquipment($plan, $equipment);

        $plan->delete();

        return response()->json(null, 204);
    }

    public function record(Request $request, Equipment $equipment, EquipmentMaintenancePlan $plan): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        $this->assertPlanBelongsToEquipment($plan, $equipment);

        $validated = $request->validate([
            'performed_at' => 'required|date',
            'result' => ['required', Rule::in([
                Calibration::RESULT_OK,
                Calibration::RESULT_OK_WITH_RESERVE,
                Calibration::RESULT_FAILED,
            ])],
            'provider' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:5000',
            'next_due_at' => 'nullable|date|after_or_equal:performed_at',
        ]);

        $performedAt = Carbon::parse($validated['performed_at']);

        $calibration = $equipment->calibrations()->create([
            'maintenance_plan_id' => $plan->id,
            'calibration_date' => $performedAt->toDateString(),
            'next_due_date' => $validated['next_due_at'] ?? null,
            'provider' => $validated['provider'] ?? $plan->provider,
            'result' => $validated['result'],
            'notes' => $validated['notes'] ?? null,
        ]);

        if (! empty($validated['next_due_at'])) {
            $plan->last_performed_at = $performedAt->toDateString();
            $plan->next_due_at = $validated['next_due_at'];
            $plan->save();
        } else {
            $plan->advanceAfterPerformance($performedAt);
        }

        return response()->json([
            'plan' => $plan->fresh(),
            'calibration' => $calibration,
        ]);
    }

    private function validatedPayload(Request $request, bool $partial = false): array
    {
        $rules = [
            'label' => [$partial ? 'sometimes' : 'required', 'string', 'max:128'],
            'kind' => ['nullable', Rule::in([
                EquipmentMaintenancePlan::KIND_ETALONNAGE,
                EquipmentMaintenancePlan::KIND_MAINTENANCE,
                EquipmentMaintenancePlan::KIND_VERIFICATION,
            ])],
            'interval_months' => [$partial ? 'sometimes' : 'required', 'integer', Rule::in([1, 3, 6, 12, 24, 36])],
            'next_due_at' => [$partial ? 'sometimes' : 'required', 'date'],
            'last_performed_at' => 'nullable|date',
            'provider' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:5000',
            'active' => 'sometimes|boolean',
        ];

        $validated = $request->validate($rules);
        $validated['kind'] = $validated['kind'] ?? EquipmentMaintenancePlan::KIND_ETALONNAGE;
        $validated['active'] = $validated['active'] ?? true;

        return $validated;
    }

    private function assertPlanBelongsToEquipment(EquipmentMaintenancePlan $plan, Equipment $equipment): void
    {
        if ((int) $plan->equipment_id !== (int) $equipment->id) {
            abort(404);
        }
    }
}
