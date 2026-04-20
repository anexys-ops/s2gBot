<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Calibration;
use App\Models\Equipment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CalibrationController extends Controller
{
    public function index(Request $request, Equipment $equipment): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        return response()->json(
            $equipment->calibrations()->with('attachments.uploader')->orderByDesc('calibration_date')->get()
        );
    }

    public function store(Request $request, Equipment $equipment): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'calibration_date' => 'required|date',
            'next_due_date' => 'nullable|date|after_or_equal:calibration_date',
            'certificate_path' => 'nullable|string|max:512',
            'provider' => 'nullable|string|max:255',
            'result' => ['required', Rule::in([Calibration::RESULT_OK, Calibration::RESULT_OK_WITH_RESERVE, Calibration::RESULT_FAILED])],
            'notes' => 'nullable|string|max:5000',
        ]);

        $calibration = $equipment->calibrations()->create($validated);

        return response()->json($calibration->load('attachments'), 201);
    }

    public function show(Request $request, Equipment $equipment, Calibration $calibration): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        if ((int) $calibration->equipment_id !== (int) $equipment->id) {
            return response()->json(['message' => 'Introuvable'], 404);
        }

        return response()->json($calibration->load('attachments.uploader'));
    }

    public function update(Request $request, Equipment $equipment, Calibration $calibration): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        if ((int) $calibration->equipment_id !== (int) $equipment->id) {
            return response()->json(['message' => 'Introuvable'], 404);
        }

        $validated = $request->validate([
            'calibration_date' => 'sometimes|date',
            'next_due_date' => 'nullable|date',
            'certificate_path' => 'nullable|string|max:512',
            'provider' => 'nullable|string|max:255',
            'result' => ['sometimes', Rule::in([Calibration::RESULT_OK, Calibration::RESULT_OK_WITH_RESERVE, Calibration::RESULT_FAILED])],
            'notes' => 'nullable|string|max:5000',
        ]);

        $calibration->update($validated);

        return response()->json($calibration->fresh()->load('attachments'));
    }

    public function destroy(Request $request, Equipment $equipment, Calibration $calibration): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        if ((int) $calibration->equipment_id !== (int) $equipment->id) {
            return response()->json(['message' => 'Introuvable'], 404);
        }

        $calibration->delete();

        return response()->json(null, 204);
    }
}
