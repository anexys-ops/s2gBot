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
            'status' => Invoice::STATUS_DRAFT,
        ]);

        $invoice->orders()->attach($orders->pluck('id'));

        $totalHt = 0;
        foreach ($orders as $order) {
            foreach ($order->orderItems as $item) {
                $unitPrice = $item->testType->unit_price;
                $qty = $item->quantity;
                $total = round($unitPrice * $qty, 2);
                $totalHt += $total;
                InvoiceLine::create([
                    'invoice_id' => $invoice->id,
                    'description' => $item->testType->name.' ('.$order->reference.')',
                    'quantity' => $qty,
                    'unit_price' => $unitPrice,
                    'total' => $total,
                    'order_item_id' => $item->id,
                ]);
            }
        }

        $tva = round($totalHt * ($invoice->tva_rate / 100), 2);
        $invoice->update([
            'amount_ht' => $totalHt,
            'amount_ttc' => $totalHt + $tva,
        ]);

        return $invoice->load(['client', 'orders', 'invoiceLines']);
    }
}
