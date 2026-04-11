<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\CommercialDocumentLink;
use App\Models\Invoice;
use App\Models\Quote;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClientCommercialController extends Controller
{
    public function overview(Request $request, Client $client): JsonResponse
    {
        $user = $request->user();
        if ($user->isClient() && $client->id !== $user->client_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        if ($user->isSiteContact() && $client->id !== $user->client_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $client->load(['sites', 'addresses', 'attachments']);

        $quotes = Quote::query()
            ->where('client_id', $client->id)
            ->with(['site', 'quoteLines'])
            ->orderByDesc('quote_date')
            ->limit(80)
            ->get();

        $invoices = Invoice::query()
            ->where('client_id', $client->id)
            ->with(['invoiceLines', 'orders'])
            ->orderByDesc('invoice_date')
            ->limit(80)
            ->get();

        $quotesByStatus = Quote::query()
            ->where('client_id', $client->id)
            ->selectRaw('status, count(*) as c')
            ->groupBy('status')
            ->pluck('c', 'status');

        $invoicesByStatus = Invoice::query()
            ->where('client_id', $client->id)
            ->selectRaw('status, count(*) as c')
            ->groupBy('status')
            ->pluck('c', 'status');

        $amountDue = (float) Invoice::query()
            ->where('client_id', $client->id)
            ->whereNotIn('status', [Invoice::STATUS_PAID, Invoice::STATUS_DRAFT])
            ->sum('amount_ttc');

        $totalInvoicedTtc = (float) Invoice::query()
            ->where('client_id', $client->id)
            ->sum('amount_ttc');

        $totalQuotesTtc = (float) Quote::query()
            ->where('client_id', $client->id)
            ->sum('amount_ttc');

        $quoteIds = $quotes->pluck('id');
        $invoiceIds = $invoices->pluck('id');

        $linkQuery = CommercialDocumentLink::query()->whereRaw('0 = 1');
        if ($quoteIds->isNotEmpty()) {
            $linkQuery->orWhere(function ($q) use ($quoteIds) {
                $q->where('source_type', 'quote')->whereIn('source_id', $quoteIds)
                    ->orWhere('target_type', 'quote')->whereIn('target_id', $quoteIds);
            });
        }
        if ($invoiceIds->isNotEmpty()) {
            $linkQuery->orWhere(function ($q) use ($invoiceIds) {
                $q->where('source_type', 'invoice')->whereIn('source_id', $invoiceIds)
                    ->orWhere('target_type', 'invoice')->whereIn('target_id', $invoiceIds);
            });
        }

        $links = $linkQuery->orderByDesc('id')->limit(200)->get();

        return response()->json([
            'client' => $client,
            'quotes' => $quotes,
            'invoices' => $invoices,
            'stats' => [
                'quotes_by_status' => $quotesByStatus,
                'invoices_by_status' => $invoicesByStatus,
                'amount_due_ttc' => round($amountDue, 2),
                'total_invoiced_ttc' => round($totalInvoicedTtc, 2),
                'total_quotes_ttc' => round($totalQuotesTtc, 2),
                'open_quotes_count' => Quote::where('client_id', $client->id)
                    ->whereNotIn('status', [Quote::STATUS_INVOICED, Quote::STATUS_LOST, Quote::STATUS_REJECTED])
                    ->count(),
            ],
            'document_links' => $links,
        ]);
    }
}
