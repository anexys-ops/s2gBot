<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BcLignePlanningAffectation;
use App\Models\BonCommande;
use App\Models\BonLivraison;
use App\Models\Client;
use App\Models\Dossier;
use App\Models\Invoice;
use App\Models\LabReport;
use App\Models\Order;
use App\Models\Quote;
use App\Models\Reglement;
use App\Models\Report;
use App\Models\Sample;
use App\Models\Site;
use App\Models\User;
use App\Support\AgencyAccess;
use App\Support\UserPresentation;
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

        if ($user->isClient() || $user->isSiteContact() || ($user->isInternal() && ! AgencyAccess::isLabSiege($user))) {
            AgencyAccess::applyOrderScope($query, $user);
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

        $scopedPortal = $user->isClient() || $user->isSiteContact();
        $scopedLabAgency = $user->isInternal() && ! AgencyAccess::isLabSiege($user);
        $scoped = $scopedPortal || $scopedLabAgency;

        $clientsQ = Client::query();
        $sitesQ = Site::query();
        $ordersQ = Order::query();
        $quotesQ = Quote::query();
        $invoicesQ = Invoice::query();

        if ($scopedPortal) {
            $clientsQ->where('id', $user->client_id);
        } elseif ($scopedLabAgency) {
            AgencyAccess::applyClientScope($clientsQ, $user);
        }

        if ($scoped) {
            AgencyAccess::applySiteScope($sitesQ, $user);
            AgencyAccess::applyOrderScope($ordersQ, $user);
            AgencyAccess::applyQuoteScope($quotesQ, $user);
            AgencyAccess::applyInvoiceScope($invoicesQ, $user);
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

        $reportsQ = Report::query()->whereHas('order', function ($q) use ($user, $scoped) {
            if ($scoped) {
                AgencyAccess::applyOrderScope($q, $user);
            }
        });

        $reportsTotal = (clone $reportsQ)->count();
        $reportsPendingReview = (clone $reportsQ)->where('review_status', Report::REVIEW_PENDING)->count();
        $reportsApproved = (clone $reportsQ)->where('review_status', Report::REVIEW_APPROVED)->count();

        $samplesQ = Sample::query()->whereHas('orderItem.order', function ($q) use ($user, $scoped) {
            if ($scoped) {
                AgencyAccess::applyOrderScope($q, $user);
            }
        });
        $samplesTotal = (clone $samplesQ)->count();
        $samplesByStatus = (clone $samplesQ)->selectRaw('status, count(*) as c')->groupBy('status')->pluck('c', 'status')->all();

        $orderToReportDays = [];
        $ordersForDelay = Order::query()
            ->with(['reports' => fn ($q) => $q->orderBy('generated_at')])
            ->whereHas('reports')
            ->when($scoped, function ($q) use ($user) {
                AgencyAccess::applyOrderScope($q, $user);
            })
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
            ->when($scoped, function ($q) use ($user) {
                AgencyAccess::applyOrderScope($q, $user);
            })
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
            ->when($scoped, function ($q) use ($user) {
                AgencyAccess::applyQuoteScope($q, $user);
            })
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
            ->when($scoped, function ($q) use ($user) {
                $q->whereHas('orderItem.order', function ($oq) use ($user) {
                    AgencyAccess::applyOrderScope($oq, $user);
                });
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

    /**
     * KPI consolidés : devis ouverts, équipes, délais chaîne documentaire, essais.
     */
    public function kpi(Request $request): JsonResponse
    {
        $user = $request->user();
        $scopedPortal = $user->isClient() || $user->isSiteContact();
        $scopedLabAgency = $user->isInternal() && ! AgencyAccess::isLabSiege($user);
        $scoped = $scopedPortal || $scopedLabAgency;

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

        $delayMetric = static function (array $days) use ($avg, $median): array {
            return [
                'avg' => $avg($days),
                'median' => $median($days),
                'sample_size' => count($days),
            ];
        };

        $openQuoteStatuses = [
            Quote::STATUS_INVOICED,
            Quote::STATUS_LOST,
            Quote::STATUS_REJECTED,
        ];

        $quotesQ = Quote::query()->with('client:id,name');
        if ($scoped) {
            AgencyAccess::applyQuoteScope($quotesQ, $user);
        }

        $quotesOpenQ = (clone $quotesQ)->whereNotIn('status', $openQuoteStatuses);
        $quotesOpenCount = (clone $quotesOpenQ)->count();
        $quotesOpenTtc = (float) (clone $quotesOpenQ)->sum('amount_ttc');
        $quotesOpenByStatus = (clone $quotesOpenQ)
            ->selectRaw('status, count(*) as c')
            ->groupBy('status')
            ->pluck('c', 'status')
            ->all();

        $quotesOpenList = (clone $quotesOpenQ)
            ->orderByDesc('quote_date')
            ->orderByDesc('id')
            ->limit(20)
            ->get(['id', 'number', 'status', 'quote_date', 'amount_ttc', 'client_id', 'valid_until'])
            ->map(fn (Quote $q) => [
                'id' => $q->id,
                'number' => $q->number,
                'status' => $q->status,
                'quote_date' => $q->quote_date?->format('Y-m-d'),
                'valid_until' => $q->valid_until?->format('Y-m-d'),
                'amount_ttc' => (float) $q->amount_ttc,
                'client_name' => $q->client?->name,
            ])
            ->values()
            ->all();

        $bcQ = BonCommande::query()->with([
            'quote:id,quote_date',
            'dossier:id,date_debut,site_id',
            'bonsLivraison:id,bon_commande_id,date_livraison',
            'invoices:id,invoice_date',
        ]);
        if ($scoped) {
            $bcQ->whereHas('dossier', fn ($d) => AgencyAccess::applyDossierScope($d, $user));
        }

        $bcCount = (clone $bcQ)->count();

        $devisBcDays = [];
        $dossierBcDays = [];
        $bcBlDays = [];
        $blFactureDays = [];
        $facturePaiementDays = [];
        $bcRapportDays = [];

        foreach ($bcQ->get(['id', 'quote_id', 'dossier_id', 'date_commande', 'created_at']) as $bc) {
            $bcDate = $bc->date_commande ?? $bc->created_at?->startOfDay();
            if (! $bcDate) {
                continue;
            }

            if ($bc->quote?->quote_date) {
                $devisBcDays[] = $bc->quote->quote_date->diffInDays($bcDate);
            }

            if ($bc->dossier?->date_debut) {
                $dossierBcDays[] = $bc->dossier->date_debut->diffInDays($bcDate);
            }

            $firstBl = $bc->bonsLivraison
                ->filter(fn (BonLivraison $bl) => $bl->date_livraison !== null)
                ->sortBy('date_livraison')
                ->first();
            if ($firstBl?->date_livraison) {
                $bcBlDays[] = $bcDate->diffInDays($firstBl->date_livraison);
            }

            $firstInvoice = $bc->invoices
                ->filter(fn (Invoice $inv) => $inv->invoice_date !== null)
                ->sortBy('invoice_date')
                ->first();
            if ($firstInvoice?->invoice_date) {
                if ($firstBl?->date_livraison) {
                    $blFactureDays[] = $firstBl->date_livraison->diffInDays($firstInvoice->invoice_date);
                }

                $firstPayment = Reglement::query()
                    ->where('invoice_id', $firstInvoice->id)
                    ->whereNotNull('payment_date')
                    ->orderBy('payment_date')
                    ->value('payment_date');
                if ($firstPayment) {
                    $facturePaiementDays[] = $firstInvoice->invoice_date->diffInDays($firstPayment);
                }
            }

            $firstReport = LabReport::query()
                ->where('bc_id', $bc->id)
                ->where(function ($q) {
                    $q->whereNotNull('emitted_at')->orWhereNotNull('signed_at');
                })
                ->orderByRaw('COALESCE(emitted_at, signed_at) ASC')
                ->first(['emitted_at', 'signed_at']);
            if ($firstReport) {
                $reportDate = $firstReport->emitted_at ?? $firstReport->signed_at;
                if ($reportDate) {
                    $bcRapportDays[] = $bcDate->diffInDays($reportDate);
                }
            }
        }

        $quotePlanningDays = [];
        $quotesPlanning = Quote::query()
            ->whereNotNull('site_delivery_date')
            ->whereNotNull('quote_date')
            ->when($scoped, fn ($q) => AgencyAccess::applyQuoteScope($q, $user))
            ->get(['quote_date', 'site_delivery_date']);
        foreach ($quotesPlanning as $q) {
            if ($q->quote_date && $q->site_delivery_date) {
                $quotePlanningDays[] = $q->quote_date->diffInDays($q->site_delivery_date);
            }
        }

        $samplesQ = Sample::query()->with('dossier:id,reference');
        if ($scoped) {
            $samplesQ->where(function ($q) use ($user) {
                $q->whereHas('dossier', fn ($d) => AgencyAccess::applyDossierScope($d, $user))
                    ->orWhereHas('orderItem.order', fn ($oq) => AgencyAccess::applyOrderScope($oq, $user));
            });
        }

        $essaiDurees = [];
        $depassant2j = 0;
        $depassant7j = 0;
        $enCoursDepassant2j = 0;
        $enCoursDepassant7j = 0;
        $alertesEssais = [];

        $samplesForEssais = (clone $samplesQ)
            ->whereNotNull('received_at')
            ->whereIn('status', [Sample::STATUS_EN_ESSAI, Sample::STATUS_TERMINE, Sample::STATUS_TESTED, Sample::STATUS_VALIDATED])
            ->get(['id', 'reference', 'fold_number', 'transco_number', 'status', 'received_at', 'updated_at', 'dossier_id']);

        foreach ($samplesForEssais as $sample) {
            $end = $sample->status === Sample::STATUS_EN_ESSAI
                ? now()
                : ($sample->updated_at ?? now());
            $days = (int) $sample->received_at->diffInDays($end);

            if ($sample->status !== Sample::STATUS_EN_ESSAI) {
                $essaiDurees[] = $days;
            }

            if ($days > 2) {
                if ($sample->status === Sample::STATUS_EN_ESSAI) {
                    $enCoursDepassant2j++;
                } else {
                    $depassant2j++;
                }
            }
            if ($days > 7) {
                if ($sample->status === Sample::STATUS_EN_ESSAI) {
                    $enCoursDepassant7j++;
                } else {
                    $depassant7j++;
                }
            }

            if ($days > 2 && ($sample->status === Sample::STATUS_EN_ESSAI || $days > 7)) {
                $niveau = $days > 7 ? 'critical' : 'warning';
                if ($sample->status === Sample::STATUS_EN_ESSAI || $niveau === 'critical') {
                    $alertesEssais[] = [
                        'sample_id' => $sample->id,
                        'reference' => $sample->reference,
                        'fold_number' => $sample->fold_number,
                        'transco_number' => $sample->transco_number,
                        'dossier_reference' => $sample->dossier?->reference,
                        'status' => $sample->status,
                        'jours' => $days,
                        'niveau' => $niveau,
                        'en_cours' => $sample->status === Sample::STATUS_EN_ESSAI,
                    ];
                }
            }
        }

        usort($alertesEssais, fn ($a, $b) => $b['jours'] <=> $a['jours']);
        $alertesEssais = array_slice($alertesEssais, 0, 30);

        $today = now()->toDateString();
        $planningRows = BcLignePlanningAffectation::query()
            ->with('user:id,name,role,poste')
            ->where('date_debut', '<=', $today)
            ->where('date_fin', '>=', $today)
            ->when($scoped, fn ($q) => $q->whereHas(
                'bonCommandeLigne.bonCommande.dossier',
                fn ($d) => AgencyAccess::applyDossierScope($d, $user)
            ))
            ->get();

        $equipeTerrain = [];
        $equipeLabo = [];
        $equipeIngenieurs = [];
        $rolesTerrain = [User::ROLE_LAB_ADMIN, User::ROLE_LAB_TECHNICIAN];
        $rolesLabo = [User::ROLE_LAB_ADMIN, User::ROLE_LAB_TECHNICIAN, User::ROLE_LABORANTIN, User::ROLE_RECEPTIONNAIRE];
        $rolesIngenieur = [User::ROLE_LAB_ADMIN, User::ROLE_INGENIEUR, User::ROLE_RESPONSABLE];

        $registerPerson = static function (array &$equipe, User $u): void {
            if (! isset($equipe[$u->id])) {
                $equipe[$u->id] = UserPresentation::technicienPayload($u);
                $equipe[$u->id]['affectations_count'] = 0;
            }
            $equipe[$u->id]['affectations_count']++;
        };

        foreach ($planningRows as $aff) {
            $u = $aff->user;
            if (! $u) {
                continue;
            }
            if (in_array($u->role, $rolesTerrain, true)) {
                $registerPerson($equipeTerrain, $u);
            }
            if (in_array($u->role, $rolesLabo, true)) {
                $registerPerson($equipeLabo, $u);
            }
            if (in_array($u->role, $rolesIngenieur, true)) {
                $registerPerson($equipeIngenieurs, $u);
            }
        }

        $dossiersQ = Dossier::query();
        if ($scoped) {
            AgencyAccess::applyDossierScope($dossiersQ, $user);
        }

        $sitesQ = Site::query();
        if ($scoped) {
            AgencyAccess::applySiteScope($sitesQ, $user);
        }

        $blQ = BonLivraison::query();
        if ($scoped) {
            $blQ->whereHas('dossier', fn ($d) => AgencyAccess::applyDossierScope($d, $user));
        }

        $labReportsQ = LabReport::query();
        if ($scoped) {
            $labReportsQ->where(function ($q) use ($user) {
                $q->whereHas('dossier', fn ($d) => AgencyAccess::applyDossierScope($d, $user))
                    ->orWhereHas('site', fn ($s) => AgencyAccess::applySiteScope($s, $user));
            });
        }

        return response()->json([
            'devis_ouverts' => [
                'count' => $quotesOpenCount,
                'montant_ttc' => $quotesOpenTtc,
                'par_statut' => $quotesOpenByStatus,
                'liste' => $quotesOpenList,
            ],
            'equipes' => [
                'terrain' => [
                    'actifs' => count($equipeTerrain),
                    'personnes' => array_values($equipeTerrain),
                ],
                'labo' => [
                    'actifs' => count($equipeLabo),
                    'personnes' => array_values($equipeLabo),
                ],
                'ingenieurs' => [
                    'actifs' => count($equipeIngenieurs),
                    'personnes' => array_values($equipeIngenieurs),
                ],
            ],
            'volumes' => [
                'dossiers' => $dossiersQ->count(),
                'chantiers' => $sitesQ->count(),
                'bons_commande' => $bcCount,
                'bons_livraison' => $blQ->count(),
                'rapports_labo' => $labReportsQ->count(),
            ],
            'delais_chaine' => [
                'dossier_bc' => $delayMetric($dossierBcDays),
                'devis_bc' => $delayMetric($devisBcDays),
                'bc_bl' => $delayMetric($bcBlDays),
                'bl_facture' => $delayMetric($blFactureDays),
                'facture_paiement' => $delayMetric($facturePaiementDays),
                'bc_rapport' => $delayMetric($bcRapportDays),
                'devis_livraison_chantier' => $delayMetric($quotePlanningDays),
            ],
            'essais' => [
                'duree_moyenne_jours' => $avg($essaiDurees),
                'duree_mediane_jours' => $median($essaiDurees),
                'sample_size' => count($essaiDurees),
                'depassant_2j' => $depassant2j,
                'depassant_7j' => $depassant7j,
                'en_cours_depasse_2j' => $enCoursDepassant2j,
                'en_cours_depasse_7j' => $enCoursDepassant7j,
                'alertes' => $alertesEssais,
            ],
        ]);
    }
}
