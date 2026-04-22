<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CorrectiveAction;
use App\Models\NonConformity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CorrectiveActionController extends Controller
{
    public function store(Request $request, NonConformity $nonConformity): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'title' => 'required|string|max:500',
            'responsible_user_id' => 'nullable|exists:users,id',
            'due_date' => 'nullable|date',
            'status' => ['required', Rule::in([
                CorrectiveAction::STATUS_PENDING,
                CorrectiveAction::STATUS_IN_PROGRESS,
                CorrectiveAction::STATUS_DONE,
                CorrectiveAction::STATUS_VERIFIED,
            ])],
            'verification_notes' => 'nullable|string|max:65535',
        ]);

        $action = $nonConformity->correctiveActions()->create($validated);

        return response()->json($action->load('responsibleUser:id,name,email'), 201);
    }

    public function update(Request $request, CorrectiveAction $correctiveAction): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'title' => 'sometimes|string|max:500',
            'responsible_user_id' => 'nullable|exists:users,id',
            'due_date' => 'nullable|date',
            'status' => ['sometimes', Rule::in([
                CorrectiveAction::STATUS_PENDING,
                CorrectiveAction::STATUS_IN_PROGRESS,
                CorrectiveAction::STATUS_DONE,
                CorrectiveAction::STATUS_VERIFIED,
            ])],
            'verification_notes' => 'nullable|string|max:65535',
        ]);

        $correctiveAction->update($validated);

        return response()->json($correctiveAction->fresh()->load('responsibleUser:id,name,email'));
    }

    public function destroy(Request $request, CorrectiveAction $correctiveAction): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $correctiveAction->delete();

        return response()->json(null, 204);
    }
}
