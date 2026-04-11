<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ExtrafieldDefinition;
use App\Models\ExtrafieldValue;
use App\Services\ExtrafieldSyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use InvalidArgumentException;

class ExtrafieldValueController extends Controller
{
    public function __construct(
        private ExtrafieldSyncService $extrafieldSyncService
    ) {}

    public function index(Request $request): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'entity_type' => ['required', Rule::in(ExtrafieldDefinition::entityTypes())],
            'entity_id' => 'required|integer|min:1',
        ]);

        return response()->json(['data' => $this->payloadForEntity($validated['entity_type'], $validated['entity_id'])]);
    }

    public function sync(Request $request): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'entity_type' => ['required', Rule::in(ExtrafieldDefinition::entityTypes())],
            'entity_id' => 'required|integer|min:1',
            'values' => 'required|array',
        ]);

        try {
            $this->extrafieldSyncService->sync(
                $validated['entity_type'],
                $validated['entity_id'],
                $validated['values']
            );
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json(['data' => $this->payloadForEntity($validated['entity_type'], $validated['entity_id'])]);
    }

    /**
     * @return \Illuminate\Support\Collection<int, array{definition: ExtrafieldDefinition, value: string|null}>
     */
    private function payloadForEntity(string $entityType, int $entityId)
    {
        $definitions = ExtrafieldDefinition::query()
            ->where('entity_type', $entityType)
            ->orderBy('sort_order')
            ->orderBy('label')
            ->get();

        $valueRows = ExtrafieldValue::query()
            ->whereIn('extrafield_definition_id', $definitions->pluck('id'))
            ->where('entity_id', $entityId)
            ->get()
            ->keyBy('extrafield_definition_id');

        return $definitions->map(function (ExtrafieldDefinition $def) use ($valueRows) {
            $v = $valueRows->get($def->id);

            return [
                'definition' => $def,
                'value' => $v?->value,
            ];
        });
    }
}
