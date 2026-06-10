<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Equipment;
use App\Models\MaterielAffectation;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class MaterielAffectationController extends Controller
{
    public function indexAll(Request $request): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'from' => 'nullable|date',
            'to' => 'nullable|date',
            'equipment_id' => 'nullable|integer|exists:equipments,id',
        ]);

        $q = MaterielAffectation::query()
            ->with(['equipment:id,code,name', 'user:id,name', 'dossier:id,reference']);

        if (! empty($validated['equipment_id'])) {
            $q->where('equipment_id', $validated['equipment_id']);
        }

        if (! empty($validated['from'])) {
            $q->where(function ($sub) use ($validated) {
                $sub->whereDate('date_retour_prevue', '>=', $validated['from'])
                    ->orWhereDate('date_retour_effective', '>=', $validated['from'])
                    ->orWhere(function ($inner) use ($validated) {
                        $inner->whereNull('date_retour_prevue')
                            ->whereNull('date_retour_effective')
                            ->whereDate('date_debut', '>=', $validated['from']);
                    });
            });
        }

        if (! empty($validated['to'])) {
            $q->whereDate('date_debut', '<=', $validated['to']);
        }

        return response()->json($q->orderByDesc('date_debut')->get());
    }

    public function index(Request $request, Equipment $equipment): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        return response()->json(
            $equipment->affectations()
                ->with(['user:id,name', 'dossier:id,reference'])
                ->orderByDesc('date_debut')
                ->get()
        );
    }

    public function store(Request $request, Equipment $equipment): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $this->validatedPayload($request);
        $affectation = $equipment->affectations()->create($validated);

        return response()->json(
            $affectation->load(['user:id,name', 'dossier:id,reference']),
            201
        );
    }

    public function update(Request $request, Equipment $equipment, MaterielAffectation $affectation): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        $this->assertBelongsToEquipment($affectation, $equipment);

        $affectation->update($this->validatedPayload($request, true));

        return response()->json(
            $affectation->fresh()->load(['user:id,name', 'dossier:id,reference'])
        );
    }

    public function destroy(Request $request, Equipment $equipment, MaterielAffectation $affectation): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        $this->assertBelongsToEquipment($affectation, $equipment);

        $affectation->delete();

        return response()->json(null, 204);
    }

    private function validatedPayload(Request $request, bool $partial = false): array
    {
        return $request->validate([
            'user_id' => [$partial ? 'sometimes' : 'nullable', 'exists:users,id'],
            'dossier_id' => 'nullable|exists:dossiers,id',
            'ordre_mission_id' => 'nullable|integer',
            'date_debut' => [$partial ? 'sometimes' : 'required', 'date'],
            'date_retour_prevue' => 'nullable|date|after_or_equal:date_debut',
            'date_retour_effective' => 'nullable|date|after_or_equal:date_debut',
            'etat_depart' => ['nullable', Rule::in(['bon', 'usage', 'degrade'])],
            'etat_retour' => ['nullable', Rule::in(['bon', 'usage', 'degrade'])],
            'observations' => 'nullable|string|max:5000',
        ]);
    }

    private function assertBelongsToEquipment(MaterielAffectation $affectation, Equipment $equipment): void
    {
        if ((int) $affectation->equipment_id !== (int) $equipment->id) {
            abort(404);
        }
    }
}
