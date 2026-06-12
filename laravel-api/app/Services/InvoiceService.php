<?php

namespace App\Services;

use App\Models\Agency;
use App\Models\BonCommande;
use App\Models\DocumentSequence;
use App\Models\Invoice;
use App\Models\InvoiceLine;
use App\Models\ModuleSetting;
use App\Models\Order;
use Illuminate\Database\Eloquent\Builder;

class InvoiceService
{
    public function __construct(
        private readonly DocumentSequenceService $documentSequences
    ) {}

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

        $agencyIds = $orders->pluck('agency_id')->filter()->unique()->values();
        if ($agencyIds->count() > 1) {
            throw new \InvalidArgumentException('Toutes les commandes doivent appartenir à la même agence.');
        }

        $number = $this->documentSequences->next(DocumentSequence::TYPE_FACTURE);

        $hqId = Agency::query()->where('client_id', $clientId)->where('is_headquarters', true)->value('id');
        $agencyId = $agencyIds->first() ?? $hqId;

        $invoice = Invoice::create([
            'number' => $number,
            'client_id' => $clientId,
            'agency_id' => $agencyId,
            'invoice_date' => now()->toDateString(),
            'due_date' => now()->addDays(30)->toDateString(),
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

    /**
     * @return list<string>
     */
    public function bcPickerStatuts(): array
    {
        $settings = ModuleSetting::query()->where('module_key', 'invoices')->value('settings');
        $fromSettings = is_array($settings) ? ($settings['bc_picker_statuts'] ?? $settings['order_picker_statuses'] ?? null) : null;
        if (is_array($fromSettings) && $fromSettings !== []) {
            $legacyLab = ['draft', 'submitted', 'in_progress', 'completed'];
            $filtered = array_values(array_filter(
                $fromSettings,
                fn ($s) => is_string($s) && $s !== '' && ! in_array($s, $legacyLab, true),
            ));
            if ($filtered !== []) {
                return $filtered;
            }
        }

        return [
            BonCommande::STATUT_CONFIRME,
            BonCommande::STATUT_EN_COURS,
            BonCommande::STATUT_LIVRE,
        ];
    }

    public function eligibleBonsCommandeQuery(?string $search = null): Builder
    {
        $q = BonCommande::query()
            ->with(['client', 'dossier'])
            ->whereIn('statut', $this->bcPickerStatuts())
            ->whereHas('lignes')
            ->whereDoesntHave('invoices')
            ->orderByDesc('date_commande')
            ->orderByDesc('id');

        if ($search = trim((string) $search)) {
            $like = '%'.$search.'%';
            $q->where(function (Builder $sub) use ($like) {
                $sub->where('numero', 'like', $like)
                    ->orWhereHas('client', fn (Builder $cq) => $cq->where('name', 'like', $like))
                    ->orWhereHas('dossier', function (Builder $dq) use ($like) {
                        $dq->where('reference', 'like', $like)
                            ->orWhere('titre', 'like', $like);
                    });
            });
        }

        return $q;
    }

    public function fromBonsCommande(array $bcIds, ?int $clientId = null): Invoice
    {
        $bcs = BonCommande::query()
            ->whereIn('id', $bcIds)
            ->with(['client', 'lignes', 'quote'])
            ->get();

        if ($bcs->isEmpty()) {
            throw new \InvalidArgumentException('Aucun bon de commande valide.');
        }

        $allowedStatuts = $this->bcPickerStatuts();
        $first = $bcs->first();
        $clientId = $clientId ?? $first->client_id;

        foreach ($bcs as $bc) {
            if ($bc->client_id !== $clientId) {
                throw new \InvalidArgumentException('Tous les bons de commande doivent appartenir au même client.');
            }
            if (! in_array($bc->statut, $allowedStatuts, true)) {
                throw new \InvalidArgumentException("Le bon de commande {$bc->numero} n'est pas éligible à la facturation.");
            }
            if ($this->isBonCommandeAlreadyInvoiced((int) $bc->id)) {
                throw new \InvalidArgumentException("Le bon de commande {$bc->numero} est déjà facturé.");
            }
            if ($bc->lignes->isEmpty()) {
                throw new \InvalidArgumentException("Le bon de commande {$bc->numero} n'a aucune ligne.");
            }
        }

        $hqId = Agency::query()->where('client_id', $clientId)->where('is_headquarters', true)->value('id');

        $invoice = Invoice::create([
            'number' => $this->documentSequences->next(DocumentSequence::TYPE_FACTURE),
            'client_id' => $clientId,
            'contact_id' => $first->contact_id,
            'agency_id' => $hqId,
            'invoice_date' => now()->toDateString(),
            'due_date' => now()->addDays(30)->toDateString(),
            'order_date' => $first->date_commande?->toDateString(),
            'amount_ht' => 0,
            'amount_ttc' => 0,
            'tva_rate' => (float) ($first->tva_rate ?? 20),
            'discount_percent' => 0,
            'discount_amount' => 0,
            'shipping_amount_ht' => 0,
            'shipping_tva_rate' => 20,
            'travel_fee_ht' => 0,
            'travel_fee_tva_rate' => 20,
            'status' => Invoice::STATUS_DRAFT,
        ]);

        $invoice->bonsCommande()->attach($bcs->pluck('id'));

        foreach ($bcs as $bc) {
            foreach ($bc->lignes as $ligne) {
                $qty = (float) $ligne->quantite;
                $unitPrice = (float) $ligne->prix_unitaire_ht;
                $tvaRate = (float) ($ligne->tva_rate ?? $bc->tva_rate ?? 20);
                $ht = CommercialDocumentTotalsService::lineHt($qty, $unitPrice, 0);
                InvoiceLine::create([
                    'invoice_id' => $invoice->id,
                    'description' => $ligne->libelle.' ('.$bc->numero.')',
                    'quantity' => max(1, (int) round($qty)),
                    'unit_price' => $unitPrice,
                    'tva_rate' => $tvaRate,
                    'discount_percent' => 0,
                    'total' => $ht,
                ]);
            }
        }

        $this->recalculateTotals($invoice);

        return $invoice->load(['client', 'bonsCommande', 'invoiceLines', 'clientContact']);
    }

    public function isBonCommandeAlreadyInvoiced(int $bcId): bool
    {
        return BonCommande::query()
            ->whereKey($bcId)
            ->whereHas('invoices')
            ->exists();
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
