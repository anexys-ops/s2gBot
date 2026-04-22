<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\NonConformity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class NonConformityController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'status' => ['nullable', Rule::in([
                NonConformity::STATUS_OPEN,
                NonConformity::STATUS_ANALYZING,
                NonConformity::STATUS_ACTION,
                NonConformity::STATUS_CLOSED,
            ])],
            'severity' => ['nullable', Rule::in([
                NonConformity::SEVERITY_MINOR,
                NonConformity::SEVERITY_MAJOR,
                NonConformity::SEVERITY_CRITICAL,
            ])],
        ]);

        $q = NonConformity::query()
            ->with([
                'detectedByUser:id,name,email',
                'sample:id,reference',
                'equipment:id,name,code',
                'order:id,reference',
            ])
            ->orderByDesc('detected_at');

        if (! empty($validated['status'])) {
            $q->where('status', $validated['status']);
        }
        if (! empty($validated['severity'])) {
            $q->where('severity', $validated['severity']);
        }

        return response()->json($q->get());
    }

    public function stats(Request $request): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $open = NonConformity::query()
            ->whereIn('status', [
                NonConformity::STATUS_OPEN,
                NonConformity::STATUS_ANALYZING,
                NonConformity::STATUS_ACTION,
            ])
            ->count();

        $closed = NonConformity::query()
            ->where('status', NonConformity::STATUS_CLOSED)
            ->count();

        $closedRows = NonConformity::query()
            ->where('status', NonConformity::STATUS_CLOSED)
            ->get(['detected_at', 'updated_at']);
        $avgResolution = null;
        if ($closedRows->isNotEmpty()) {
            $avgResolution = round(
                (float) $closedRows->avg(
                    fn (NonConformity $n) => (float) $n->detected_at->diffInSeconds($n->updated_at) / 86400.0
                ),
                1
            );
        }

        return response()->json([
            'open' => $open,
            'closed' => $closed,
            'avg_resolution_days' => $avgResolution,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'detected_at' => 'required|date',
            'detected_by' => 'required|exists:users,id',
            'sample_id' => 'nullable|exists:samples,id',
            'equipment_id' => 'nullable|exists:equipments,id',
            'order_id' => 'nullable|exists:orders,id',
            'severity' => ['required', Rule::in([
                NonConformity::SEVERITY_MINOR,
                NonConformity::SEVERITY_MAJOR,
                NonConformity::SEVERITY_CRITICAL,
            ])],
            'description' => 'required|string|max:65535',
            'status' => ['required', Rule::in([
                NonConformity::STATUS_OPEN,
                NonConformity::STATUS_ANALYZING,
                NonConformity::STATUS_ACTION,
                NonConformity::STATUS_CLOSED,
            ])],
            'meta' => 'nullable|array',
        ]);

        $nc = null;
        DB::transaction(function () use (&$nc, $validated) {
            $year = (int) date('Y', strtotime((string) $validated['detected_at']));
            $prefix = sprintf('NC-%d-', $year);
            $last = NonConformity::query()
                ->where('reference', 'like', $prefix.'%')
                ->lockForUpdate()
                ->orderByDesc('id')
                ->value('reference');
            $seq = 1;
            if (is_string($last) && preg_match('/^NC-\d+-(\d+)$/', $last, $m)) {
                $seq = (int) $m[1] + 1;
            }
            $validated['reference'] = sprintf('NC-%d-%05d', $year, $seq);
            $nc = NonConformity::create($validated);
        });

        return response()->json(
            $nc?->load(['detectedByUser', 'sample', 'equipment', 'order']),
            201
        );
    }

    public function show(Request $request, NonConformity $nonConformity): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        return response()->json(
            $nonConformity->load([
                'detectedByUser',
                'sample',
                'equipment',
                'order',
                'correctiveActions.responsibleUser:id,name,email',
            ])
        );
    }

    public function update(Request $request, NonConformity $nonConformity): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'detected_at' => 'sometimes|date',
            'detected_by' => 'sometimes|exists:users,id',
            'sample_id' => 'nullable|exists:samples,id',
            'equipment_id' => 'nullable|exists:equipments,id',
            'order_id' => 'nullable|exists:orders,id',
            'severity' => ['sometimes', Rule::in([
                NonConformity::SEVERITY_MINOR,
                NonConformity::SEVERITY_MAJOR,
                NonConformity::SEVERITY_CRITICAL,
            ])],
            'description' => 'sometimes|string|max:65535',
            'status' => ['sometimes', Rule::in([
                NonConformity::STATUS_OPEN,
                NonConformity::STATUS_ANALYZING,
                NonConformity::STATUS_ACTION,
                NonConformity::STATUS_CLOSED,
            ])],
            'meta' => 'nullable|array',
        ]);

        $nonConformity->update($validated);

        return response()->json(
            $nonConformity->fresh()->load([
                'detectedByUser',
                'sample',
                'equipment',
                'order',
                'correctiveActions.responsibleUser:id,name,email',
            ])
        );
    }

    public function destroy(Request $request, NonConformity $nonConformity): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $nonConformity->delete();

        return response()->json(null, 204);
    }
}
