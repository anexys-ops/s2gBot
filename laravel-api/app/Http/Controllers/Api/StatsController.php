<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\TestResult;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StatsController extends Controller
{
    /**
     * Statistiques essais pour graphiques : par type, récents, évolution.
     */
    public function essais(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Order::query()->with(['orderItems.testType.params', 'orderItems.samples.testResults.testTypeParam']);

        if ($user->isClient() || $user->isSiteContact()) {
            $query->where('client_id', $user->client_id);
        }

        $orders = $query->orderByDesc('order_date')->limit(200)->get();

        $parType = [];
        $recentResults = [];
        $evolutionParMois = [];

        foreach ($orders as $order) {
            $orderDate = $order->order_date?->format('Y-m');
            if ($orderDate) {
                $evolutionParMois[$orderDate] = ($evolutionParMois[$orderDate] ?? 0) + 1;
            }

            foreach ($order->orderItems ?? [] as $item) {
                $testType = $item->testType;
                if (! $testType) {
                    continue;
                }
                $typeId = $testType->id;
                $typeName = $testType->name;

                if (! isset($parType[$typeId])) {
                    $parType[$typeId] = [
                        'test_type_id' => $typeId,
                        'test_type_name' => $typeName,
                        'norm' => $testType->norm,
                        'count_essais' => 0,
                        'count_resultats' => 0,
                        'valeurs_par_param' => [],
                        'dernieres_valeurs' => [],
                    ];
                }

                foreach ($item->samples ?? [] as $sample) {
                    $parType[$typeId]['count_essais']++;
                    foreach ($sample->testResults ?? [] as $tr) {
                        $parType[$typeId]['count_resultats']++;
                        $paramName = $tr->testTypeParam?->name ?? 'Param';
                        $num = is_numeric($tr->value) ? (float) $tr->value : null;

                        if (! isset($parType[$typeId]['valeurs_par_param'][$paramName])) {
                            $parType[$typeId]['valeurs_par_param'][$paramName] = ['values' => [], 'unit' => $tr->testTypeParam?->unit];
                        }
                        if ($num !== null) {
                            $parType[$typeId]['valeurs_par_param'][$paramName]['values'][] = $num;
                        }

                        $recentResults[] = [
                            'id' => $tr->id,
                            'date' => $tr->created_at?->toIso8601String(),
                            'order_reference' => $order->reference,
                            'sample_reference' => $sample->reference,
                            'test_type_name' => $typeName,
                            'param_name' => $paramName,
                            'value' => $tr->value,
                            'unit' => $tr->testTypeParam?->unit,
                        ];
                    }
                }
            }
        }

        // Limiter et trier les résultats récents (30 derniers)
        usort($recentResults, fn ($a, $b) => strcmp($b['date'] ?? '', $a['date'] ?? ''));
        $recentResults = array_slice($recentResults, 0, 30);

        // Résumer valeurs par param (min, max, moyenne, count) et dernieres_valeurs par type
        $allValuesByType = [];
        foreach (array_keys($parType) as $typeId) {
            $allValuesByType[$typeId] = [];
            foreach (array_keys($parType[$typeId]['valeurs_par_param']) as $paramName) {
                $v = &$parType[$typeId]['valeurs_par_param'][$paramName]['values'];
                $parType[$typeId]['valeurs_par_param'][$paramName]['min'] = count($v) ? min($v) : null;
                $parType[$typeId]['valeurs_par_param'][$paramName]['max'] = count($v) ? max($v) : null;
                $parType[$typeId]['valeurs_par_param'][$paramName]['moyenne'] = count($v) ? round(array_sum($v) / count($v), 2) : null;
                $parType[$typeId]['valeurs_par_param'][$paramName]['count'] = count($v);
                $allValuesByType[$typeId] = array_merge($allValuesByType[$typeId], $v);
            }
            $parType[$typeId]['dernieres_valeurs'] = array_slice($allValuesByType[$typeId], -20);
        }

        // Évolution par mois (tri chronologique)
        ksort($evolutionParMois);
        $evolution = [];
        foreach ($evolutionParMois as $mois => $count) {
            $evolution[] = ['mois' => $mois, 'count' => $count];
        }

        return response()->json([
            'par_type' => array_values($parType),
            'recent_results' => $recentResults,
            'evolution' => $evolution,
        ]);
    }
}
