<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\Quote;
use App\Models\Report;
use App\Models\Sample;
use App\Models\Site;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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

    /**
     * Vue synthétique pour tableau de bord et rapports (KPI, délais, CA).
     */
    public function dashboard(Request $request): JsonResponse
    {
        $user = $request->user();

        $clientIds = null;
        if ($user->isClient() || $user->isSiteContact()) {
            $clientIds = [$user->client_id];
        }

        $clientsQ = Client::query();
        $sitesQ = Site::query();
        $ordersQ = Order::query();
        $quotesQ = Quote::query();
        $invoicesQ = Invoice::query();

        if ($clientIds !== null) {
            $clientsQ->whereIn('id', $clientIds);
            $sitesQ->whereIn('client_id', $clientIds);
            $ordersQ->whereIn('client_id', $clientIds);
            $quotesQ->whereIn('client_id', $clientIds);
            $invoicesQ->whereIn('client_id', $clientIds);
        }

        $ordersByStatus = (clone $ordersQ)->selectRaw('status, count(*) as c')->groupBy('status')->pluck('c', 'status')->all();
        $quotesByStatus = (clone $quotesQ)->selectRaw('status, count(*) as c')->groupBy('status')->pluck('c', 'status')->all();
        $invoicesByStatus = (clone $invoicesQ)->selectRaw('status, count(*) as c')->groupBy('status')->pluck('c', 'status')->all();

        $invoicesTtcTotal = (float) (clone $invoicesQ)->sum('amount_ttc');
        $invoicesTtcPaid = (float) (clone $invoicesQ)->where('status', Invoice::STATUS_PAID)->sum('amount_ttc');
        $invoicesTtcUnpaid = (float) (clone $invoicesQ)->where('status', '!=', Invoice::STATUS_PAID)->sum('amount_ttc');

        $quotesOpenTtc = (clone $quotesQ)
            ->whereNotIn('status', [Quote::STATUS_INVOICED, Quote::STATUS_LOST, Quote::STATUS_REJECTED])
            ->sum('amount_ttc');

        $reportsQ = Report::query()->whereHas('order', function ($q) use ($clientIds) {
            if ($clientIds !== null) {
                $q->whereIn('client_id', $clientIds);
            }
        });

        $reportsTotal = (clone $reportsQ)->count();
        $reportsPendingReview = (clone $reportsQ)->where('review_status', Report::REVIEW_PENDING)->count();
        $reportsApproved = (clone $reportsQ)->where('review_status', Report::REVIEW_APPROVED)->count();

        $samplesQ = Sample::query()->whereHas('orderItem.order', function ($q) use ($clientIds) {
            if ($clientIds !== null) {
                $q->whereIn('client_id', $clientIds);
            }
        });
        $samplesTotal = (clone $samplesQ)->count();
        $samplesByStatus = (clone $samplesQ)->selectRaw('status, count(*) as c')->groupBy('status')->pluck('c', 'status')->all();

        $orderToReportDays = [];
        $ordersForDelay = Order::query()
            ->with(['reports' => fn ($q) => $q->orderBy('generated_at')])
            ->whereHas('reports')
            ->when($clientIds !== null, fn ($q) => $q->whereIn('client_id', $clientIds))
            ->get();
        foreach ($ordersForDelay as $order) {
            $first = $order->reports->first();
            if ($first && $first->generated_at && $order->order_date) {
                $orderToReportDays[] = $order->order_date->diffInDays($first->generated_at);
            }
        }

        $chantierCycleDays = [];
        $ordersChantier = Order::query()
            ->whereNotNull('delivery_date')
            ->when($clientIds !== null, fn ($q) => $q->whereIn('client_id', $clientIds))
            ->get(['order_date', 'delivery_date']);
        foreach ($ordersChantier as $o) {
            if ($o->order_date && $o->delivery_date) {
                $chantierCycleDays[] = $o->order_date->diffInDays($o->delivery_date);
            }
        }

        $quotePlanningDays = [];
        $quotesPlanning = Quote::query()
            ->whereNotNull('site_delivery_date')
            ->whereNotNull('quote_date')
            ->when($clientIds !== null, fn ($q) => $q->whereIn('client_id', $clientIds))
            ->get(['quote_date', 'site_delivery_date']);
        foreach ($quotesPlanning as $q) {
            if ($q->quote_date && $q->site_delivery_date) {
                $quotePlanningDays[] = $q->quote_date->diffInDays($q->site_delivery_date);
            }
        }

        $sampleReceptionDays = [];
        $samplesRecv = Sample::query()
            ->whereNotNull('received_at')
            ->with('orderItem.order')
            ->when($clientIds !== null, function ($q) use ($clientIds) {
                $q->whereHas('orderItem.order', fn ($oq) => $oq->whereIn('client_id', $clientIds));
            })
            ->get();
        foreach ($samplesRecv as $s) {
            $od = $s->orderItem?->order?->order_date;
            if ($od && $s->received_at) {
                $sampleReceptionDays[] = $od->diffInDays($s->received_at);
            }
        }

        $invForCa = clone $invoicesQ;
        if (DB::getDriverName() === 'sqlite') {
            $caParMois = $invForCa
                ->selectRaw("strftime('%Y-%m', invoice_date) as mois, coalesce(sum(amount_ttc),0) as ca")
                ->groupBy('mois')
                ->orderBy('mois')
                ->get()
                ->map(fn ($row) => ['mois' => $row->mois, 'ca_ttc' => (float) $row->ca])
                ->values()
                ->all();
        } else {
            $caParMois = $invForCa
                ->selectRaw('DATE_FORMAT(invoice_date, "%Y-%m") as mois, coalesce(sum(amount_ttc),0) as ca')
                ->groupBy('mois')
                ->orderBy('mois')
                ->get()
                ->map(fn ($row) => ['mois' => $row->mois, 'ca_ttc' => (float) $row->ca])
                ->values()
                ->all();
        }

        $avg = static function (array $vals): ?float {
            $vals = array_values(array_filter($vals, static fn ($v) => $v !== null && $v >= 0));
            if (count($vals) === 0) {
                return null;
            }

            return round(array_sum($vals) / count($vals), 1);
        };

        $median = static function (array $vals): ?float {
            $vals = array_values(array_filter($vals, static fn ($v) => $v !== null && $v >= 0));
            sort($vals);
            $n = count($vals);
            if ($n === 0) {
                return null;
            }
            $mid = (int) floor(($n - 1) / 2);
            if ($n % 2 === 1) {
                return round($vals[$mid], 1);
            }

            return round(($vals[$mid] + $vals[$mid + 1]) / 2, 1);
        };

        return response()->json([
            'counts' => [
                'clients' => $clientsQ->count(),
                'sites' => $sitesQ->count(),
                'orders' => $ordersQ->count(),
                'orders_by_status' => $ordersByStatus,
                'quotes' => $quotesQ->count(),
                'quotes_by_status' => $quotesByStatus,
                'invoices' => $invoicesQ->count(),
                'invoices_by_status' => $invoicesByStatus,
                'reports_total' => $reportsTotal,
                'reports_pending_review' => $reportsPendingReview,
                'reports_approved' => $reportsApproved,
                'samples_total' => $samplesTotal,
                'samples_by_status' => $samplesByStatus,
            ],
            'amounts' => [
                'invoices_ttc_total' => $invoicesTtcTotal,
                'invoices_ttc_paid' => $invoicesTtcPaid,
                'invoices_ttc_unpaid' => $invoicesTtcUnpaid,
                'quotes_open_ttc' => (float) $quotesOpenTtc,
            ],
            'delays' => [
                'order_to_first_report_days_avg' => $avg($orderToReportDays),
                'order_to_first_report_days_median' => $median($orderToReportDays),
                'order_to_first_report_sample_size' => count($orderToReportDays),
                'order_delivery_cycle_days_avg' => $avg($chantierCycleDays),
                'order_delivery_cycle_days_median' => $median($chantierCycleDays),
                'order_delivery_cycle_sample_size' => count($chantierCycleDays),
                'quote_to_site_delivery_days_avg' => $avg($quotePlanningDays),
                'quote_to_site_delivery_days_median' => $median($quotePlanningDays),
                'quote_planning_sample_size' => count($quotePlanningDays),
                'sample_reception_days_avg' => $avg($sampleReceptionDays),
                'sample_reception_days_median' => $median($sampleReceptionDays),
                'sample_reception_sample_size' => count($sampleReceptionDays),
            ],
            'ca_par_mois' => $caParMois,
        ]);
    }
}
