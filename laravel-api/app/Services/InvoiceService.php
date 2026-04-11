<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\InvoiceLine;
use App\Models\Order;
use Illuminate\Support\Carbon;

class InvoiceService
{
    public function fromOrders(array $orderIds, ?int $clientId = null): Invoice
    {
        $orders = Order::query()
            ->whereIn('id', $orderIds)
            ->with(['client', 'orderItems.testType'])
            ->get();

        if ($orders->isEmpty()) {
            throw new \InvalidArgumentException('Aucune commande valide.');
        }

        $first = $orders->first();
        $clientId = $clientId ?? $first->client_id;

        foreach ($orders as $order) {
            if ($order->client_id !== $clientId) {
                throw new \InvalidArgumentException('Toutes les commandes doivent appartenir au même client.');
            }
        }

        $number = 'FAC-'.Carbon::now()->format('Ymd').'-'.str_pad((string) (Invoice::count() + 1), 4, '0', STR_PAD_LEFT);

        $invoice = Invoice::create([
            'number' => $number,
            'client_id' => $clientId,
            'invoice_date' => Carbon::now()->toDateString(),
            'due_date' => Carbon::now()->addDays(30)->toDateString(),
            'amount_ht' => 0,
            'amount_ttc' => 0,
            'tva_rate' => 20,
            'discount_percent' => 0,
            'discount_amount' => 0,
            'shipping_amount_ht' => 0,
            'shipping_tva_rate' => 20,
            'travel_fee_ht' => 0,
            'travel_fee_tva_rate' => 20,
            'status' => Invoice::STATUS_DRAFT,
        ]);

        $invoice->orders()->attach($orders->pluck('id'));

        $firstOrder = $orders->first();
        if ($firstOrder->site_id) {
            $firstOrder->load('site');
            $site = $firstOrder->site;
            if ($site && (float) $site->travel_fee_invoice_ht > 0) {
                $invoice->travel_fee_ht = (float) $site->travel_fee_invoice_ht;
                $invoice->save();
            }
        }

        foreach ($orders as $order) {
            foreach ($order->orderItems as $item) {
                $unitPrice = $item->testType->unit_price;
                $qty = $item->quantity;
                $ht = CommercialDocumentTotalsService::lineHt((float) $qty, (float) $unitPrice, 0);
                InvoiceLine::create([
                    'invoice_id' => $invoice->id,
                    'description' => $item->testType->name.' ('.$order->reference.')',
                    'quantity' => $qty,
                    'unit_price' => $unitPrice,
                    'tva_rate' => 20,
                    'discount_percent' => 0,
                    'total' => $ht,
                    'order_item_id' => $item->id,
                ]);
            }
        }

        $this->recalculateTotals($invoice);

        return $invoice->load(['client', 'orders', 'invoiceLines']);
    }

    public function recalculateTotals(Invoice $invoice): void
    {
        $invoice->load('invoiceLines');
        $lines = [];
        foreach ($invoice->invoiceLines as $line) {
            $lines[] = [
                'ht' => (float) $line->total,
                'tva_rate' => (float) $line->tva_rate,
            ];
        }

        if ($lines === []) {
            return;
        }

        $totals = CommercialDocumentTotalsService::computeTotals(
            $lines,
            (float) $invoice->discount_percent,
            (float) $invoice->discount_amount,
            (float) $invoice->shipping_amount_ht,
            (float) $invoice->shipping_tva_rate,
            (float) $invoice->travel_fee_ht,
            (float) $invoice->travel_fee_tva_rate,
        );

        $invoice->update([
            'amount_ht' => $totals['amount_ht'],
            'amount_ttc' => $totals['amount_ttc'],
        ]);
    }
}
