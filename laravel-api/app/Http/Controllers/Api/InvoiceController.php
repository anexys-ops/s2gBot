<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\InvoiceEmailMailable;
use App\Models\Agency;
use App\Models\DocumentSequence;
use App\Models\Invoice;
use App\Models\InvoiceLine;
use App\Models\MailLog;
use App\Models\MailTemplate;
use App\Services\DocumentSequenceService;
use App\Support\AgencyAccess;
use App\Support\ClientContactDocument;
use Illuminate\Database\Eloquent\Builder;
use App\Services\CommercialDocumentTotalsService;
use App\Services\InvoiceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\URL;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class InvoiceController extends Controller
{
    public function __construct(
        private InvoiceService $invoiceService,
        private DocumentSequenceService $documentSequences
    ) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Invoice::query()->with([
            'client',
            'clientContact',
            'agency',
            'orders',
            'invoiceLines',
            'billingAddress',
            'deliveryAddress',
            'pdfTemplate',
        ]);

        if (! $user->isLab()) {
            AgencyAccess::applyInvoiceScope($query, $user);
        }

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('number', 'like', '%'.$search.'%')
                    ->orWhereHas('client', function ($cq) use ($search) {
                        $cq->where('name', 'like', '%'.$search.'%');
                    });
            });
        }

        $this->applyInvoiceStatusFilter($query, $request);
        $this->applyQuickFilter($query, $request);

        // Multi-status filter: ?statuses[]=sent&statuses[]=overdue
        if ($request->has('statuses') && is_array($request->statuses) && count($request->statuses) > 0) {
            $allowed = Invoice::statuses();
            $filtered = array_values(array_intersect($request->statuses, $allowed));
            if (count($filtered) > 0) {
                $query->whereIn('status', $filtered);
            }
        }

        if ($request->filled('client_id')) {
            $query->where('client_id', (int) $request->query('client_id'));
        }

        $invoices = $query->orderByDesc('invoice_date')->paginate(15);

        return response()->json($invoices);
    }

    public function unpaid(Request $request): JsonResponse
    {
        $user = $request->user();

        // Optionnel : ?status=sent,relanced  ou  ?status[]=sent&status[]=relanced
        // Override the default scope with the specified statuses (validated against known statuses).
        $overrideStatuses = null;
        if ($request->has('status')) {
            $raw = $request->query('status');
            if (is_string($raw) && str_contains($raw, ',')) {
                $parsed = array_values(array_filter(array_map('trim', explode(',', $raw))));
            } elseif (is_array($raw)) {
                $parsed = array_values(array_filter(array_map('trim', $raw)));
            } elseif (is_string($raw) && $raw !== '') {
                $parsed = [trim($raw)];
            } else {
                $parsed = [];
            }
            $allowed = Invoice::statuses();
            $overrideStatuses = array_values(array_intersect($parsed, $allowed));
        }

        if ($overrideStatuses !== null && count($overrideStatuses) > 0) {
            $query = Invoice::query()->whereIn('status', $overrideStatuses);
        } else {
            $query = Invoice::unpaid();
        }

        $query->with(['client:id,name']);

        if (! $user->isLab()) {
            AgencyAccess::applyInvoiceScope($query, $user);
        }

        if ($request->filled('client_id')) {
            $query->where('client_id', (int) $request->query('client_id'));
        }

        if ($request->boolean('overdue_only')) {
            $query->where('due_date', '<', now()->toDateString());
        }

        // Total avant pagination
        $totalAmountDueTtc = number_format((float) (clone $query)->sum('amount_ttc'), 2, '.', '');

        $sortBy = $request->query('sort') === 'due_date' ? 'due_date' : 'invoice_date';
        $query->orderBy($sortBy);

        $invoices = $query->paginate(50);

        $items = $invoices->getCollection()->map(function (Invoice $invoice) {
            return [
                'id'           => $invoice->id,
                'ref'          => $invoice->number,
                'client'       => $invoice->client ? ['id' => $invoice->client->id, 'name' => $invoice->client->name] : null,
                'amount_ttc'   => $invoice->amount_ttc,
                'due_date'     => $invoice->due_date?->toDateString(),
                'status'       => $invoice->status,
                'days_overdue' => 0,
            ];
        });

        $payload = $invoices->toArray();
        $payload['data'] = $items->values()->all();
        $payload['total_amount_due_ttc'] = $totalAmountDueTtc;

        return response()->json($payload);
    }

    public function pdfLink(Request $request, Invoice $invoice): JsonResponse
    {
        if (! AgencyAccess::userMayAccessInvoice($request->user(), $invoice)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $url = URL::temporarySignedRoute(
            'invoice.pdf.signed',
            now()->addMinutes(15),
            ['invoice' => $invoice->id]
        );

        return response()->json(['url' => $url]);
    }

    public function signedPdf(Invoice $invoice, PdfController $pdfController): StreamedResponse
    {
        return $pdfController->streamInvoicePdf($invoice, null);
    }

    public function fromOrders(Request $request): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'order_ids' => 'required|array|min:1',
            'order_ids.*' => 'integer|exists:orders,id',
            'client_id' => 'nullable|exists:clients,id',
        ]);

        try {
            $invoice = $this->invoiceService->fromOrders(
                $validated['order_ids'],
                $validated['client_id'] ?? null
            );
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json($invoice, 201);
    }

    public function eligibleBonsCommande(Request $request): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $search = trim((string) $request->query('search', ''));
        $limit = min(100, max(1, (int) $request->query('limit', 100)));

        $items = $this->invoiceService
            ->eligibleBonsCommandeQuery($search !== '' ? $search : null)
            ->limit($limit)
            ->get()
            ->map(fn ($bc) => [
                'id' => $bc->id,
                'numero' => $bc->numero,
                'statut' => $bc->statut,
                'date_commande' => $bc->date_commande?->format('Y-m-d'),
                'montant_ht' => $bc->montant_ht,
                'montant_ttc' => $bc->montant_ttc,
                'client' => $bc->client ? ['id' => $bc->client->id, 'name' => $bc->client->name] : null,
                'dossier' => $bc->dossier ? [
                    'id' => $bc->dossier->id,
                    'reference' => $bc->dossier->reference,
                    'titre' => $bc->dossier->titre,
                ] : null,
            ])
            ->values();

        return response()->json(['data' => $items]);
    }

    public function fromBonsCommande(Request $request): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'bon_commande_ids' => 'required|array|min:1',
            'bon_commande_ids.*' => 'integer|exists:bons_commande,id',
            'client_id' => 'nullable|exists:clients,id',
        ]);

        try {
            $invoice = $this->invoiceService->fromBonsCommande(
                $validated['bon_commande_ids'],
                $validated['client_id'] ?? null
            );
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json($invoice, 201);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'number' => 'nullable|string|max:50|unique:invoices,number',
            'client_id' => 'required|exists:clients,id',
            'invoice_date' => 'required|date',
            'order_date' => 'nullable|date',
            'site_delivery_date' => 'nullable|date',
            'due_date' => 'nullable|date',
            'tva_rate' => 'nullable|numeric|min:0|max:100',
            'discount_percent' => 'nullable|numeric|min:0|max:100',
            'discount_amount' => 'nullable|numeric|min:0',
            'shipping_amount_ht' => 'nullable|numeric|min:0',
            'shipping_tva_rate' => 'nullable|numeric|min:0|max:100',
            'travel_fee_ht' => 'nullable|numeric|min:0',
            'travel_fee_tva_rate' => 'nullable|numeric|min:0|max:100',
            'billing_address_id' => 'nullable|exists:client_addresses,id',
            'delivery_address_id' => 'nullable|exists:client_addresses,id',
            'pdf_template_id' => 'nullable|exists:document_pdf_templates,id',
            'status' => ['nullable', Rule::in(Invoice::statuses())],
            'amount_ht' => 'nullable|numeric|min:0',
            'lines' => 'nullable|array|min:1',
            'lines.*.description' => 'required_with:lines|string|max:500',
            'lines.*.quantity' => 'required_with:lines|integer|min:1',
            'lines.*.unit_price' => 'required_with:lines|numeric|min:0',
            'lines.*.tva_rate' => 'nullable|numeric|min:0|max:100',
            'lines.*.discount_percent' => 'nullable|numeric|min:0|max:100',
            'meta' => 'nullable|array',
            'contact_id' => 'nullable|exists:client_contacts,id',
        ]);

        ClientContactDocument::assertBelongsToClient(
            isset($validated['contact_id']) ? (int) $validated['contact_id'] : null,
            (int) $validated['client_id'],
        );

        $tvaRate = $validated['tva_rate'] ?? 20;

        $agencyId = Agency::query()
            ->where('client_id', $validated['client_id'])
            ->where('is_headquarters', true)
            ->value('id');

        $number = isset($validated['number']) && trim((string) $validated['number']) !== ''
            ? (string) $validated['number']
            : $this->documentSequences->next(DocumentSequence::TYPE_FACTURE);

        $invoice = Invoice::create([
            'number' => $number,
            'client_id' => $validated['client_id'],
            'contact_id' => $validated['contact_id'] ?? null,
            'agency_id' => $agencyId,
            'invoice_date' => $validated['invoice_date'],
            'order_date' => $validated['order_date'] ?? null,
            'site_delivery_date' => $validated['site_delivery_date'] ?? null,
            'due_date' => $validated['due_date'] ?? null,
            'amount_ht' => 0,
            'amount_ttc' => 0,
            'tva_rate' => $tvaRate,
            'discount_percent' => $validated['discount_percent'] ?? 0,
            'discount_amount' => $validated['discount_amount'] ?? 0,
            'shipping_amount_ht' => $validated['shipping_amount_ht'] ?? 0,
            'shipping_tva_rate' => $validated['shipping_tva_rate'] ?? 20,
            'travel_fee_ht' => $validated['travel_fee_ht'] ?? 0,
            'travel_fee_tva_rate' => $validated['travel_fee_tva_rate'] ?? 20,
            'billing_address_id' => $validated['billing_address_id'] ?? null,
            'delivery_address_id' => $validated['delivery_address_id'] ?? null,
            'pdf_template_id' => $validated['pdf_template_id'] ?? null,
            'status' => $validated['status'] ?? Invoice::STATUS_DRAFT,
            'meta' => $validated['meta'] ?? null,
        ]);

        if (! empty($validated['lines'])) {
            foreach ($validated['lines'] as $line) {
                $tva = isset($line['tva_rate']) ? (float) $line['tva_rate'] : $tvaRate;
                $disc = isset($line['discount_percent']) ? (float) $line['discount_percent'] : 0;
                $ht = CommercialDocumentTotalsService::lineHt(
                    (float) $line['quantity'],
                    (float) $line['unit_price'],
                    $disc,
                );
                InvoiceLine::create([
                    'invoice_id' => $invoice->id,
                    'description' => $line['description'],
                    'quantity' => (int) $line['quantity'],
                    'unit_price' => $line['unit_price'],
                    'tva_rate' => $tva,
                    'discount_percent' => $disc,
                    'total' => $ht,
                ]);
            }
            $this->invoiceService->recalculateTotals($invoice);
        } elseif (isset($validated['amount_ht'])) {
            $amountTtc = $validated['amount_ht'] * (1 + $tvaRate / 100);
            $invoice->update([
                'amount_ht' => $validated['amount_ht'],
                'amount_ttc' => round($amountTtc, 2),
            ]);
        }

        return response()->json($invoice->fresh()->load([
            'client', 'clientContact', 'orders', 'invoiceLines', 'billingAddress', 'deliveryAddress', 'pdfTemplate',
        ]), 201);
    }

    public function show(Request $request, Invoice $invoice): JsonResponse
    {
        $user = $request->user();
        if (! AgencyAccess::userMayAccessInvoice($user, $invoice)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        return response()->json($invoice->load([
            'client', 'clientContact', 'agency', 'orders', 'invoiceLines', 'billingAddress', 'deliveryAddress', 'pdfTemplate', 'attachments',
        ]));
    }

    public function update(Request $request, Invoice $invoice): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $statusRule = Rule::in(Invoice::statuses());

        if ($invoice->status !== Invoice::STATUS_DRAFT) {
            $validated = $request->validate([
                'status' => ['sometimes', $statusRule],
                'due_date' => 'nullable|date',
                'next_reminder_date' => 'nullable|date',
                'reminder_notes' => 'nullable|string|max:5000',
                'notes' => 'nullable|string|max:5000',
                'pdf_template_id' => 'nullable|exists:document_pdf_templates,id',
                'meta' => 'nullable|array',
                'contact_id' => 'nullable|exists:client_contacts,id',
            ]);
            $invoice->update($validated);
            $invoice->refresh();
            ClientContactDocument::assertBelongsToClient($invoice->contact_id, (int) $invoice->client_id);

            return response()->json($invoice->fresh()->load([
                'client', 'clientContact', 'orders', 'invoiceLines', 'billingAddress', 'deliveryAddress', 'pdfTemplate',
            ]));
        }

        $validated = $request->validate([
            'number' => 'sometimes|string|max:50|unique:invoices,number,'.$invoice->id,
            'client_id' => 'sometimes|exists:clients,id',
            'invoice_date' => 'sometimes|date',
            'order_date' => 'nullable|date',
            'site_delivery_date' => 'nullable|date',
            'due_date' => 'nullable|date',
            'tva_rate' => 'nullable|numeric|min:0|max:100',
            'discount_percent' => 'nullable|numeric|min:0|max:100',
            'discount_amount' => 'nullable|numeric|min:0',
            'shipping_amount_ht' => 'nullable|numeric|min:0',
            'shipping_tva_rate' => 'nullable|numeric|min:0|max:100',
            'travel_fee_ht' => 'nullable|numeric|min:0',
            'travel_fee_tva_rate' => 'nullable|numeric|min:0|max:100',
            'billing_address_id' => 'nullable|exists:client_addresses,id',
            'delivery_address_id' => 'nullable|exists:client_addresses,id',
            'pdf_template_id' => 'nullable|exists:document_pdf_templates,id',
            'status' => ['sometimes', $statusRule],
            'lines' => 'sometimes|array|min:1',
            'lines.*.description' => 'required_with:lines|string|max:500',
            'lines.*.quantity' => 'required_with:lines|integer|min:1',
            'lines.*.unit_price' => 'required_with:lines|numeric|min:0',
            'lines.*.tva_rate' => 'nullable|numeric|min:0|max:100',
            'lines.*.discount_percent' => 'nullable|numeric|min:0|max:100',
            'notes' => 'nullable|string|max:5000',
            'next_reminder_date' => 'nullable|date',
            'reminder_notes' => 'nullable|string|max:5000',
            'meta' => 'nullable|array',
            'contact_id' => 'nullable|exists:client_contacts,id',
        ]);

        $invoice->fill(collect($validated)->except('lines')->toArray());
        ClientContactDocument::assertBelongsToClient($invoice->contact_id, (int) $invoice->client_id);

        if (isset($validated['lines'])) {
            $defaultTva = $validated['tva_rate'] ?? $invoice->tva_rate;
            $invoice->invoiceLines()->delete();
            foreach ($validated['lines'] as $line) {
                $tva = isset($line['tva_rate']) ? (float) $line['tva_rate'] : (float) $defaultTva;
                $disc = isset($line['discount_percent']) ? (float) $line['discount_percent'] : 0;
                $ht = CommercialDocumentTotalsService::lineHt(
                    (float) $line['quantity'],
                    (float) $line['unit_price'],
                    $disc,
                );
                InvoiceLine::create([
                    'invoice_id' => $invoice->id,
                    'description' => $line['description'],
                    'quantity' => (int) $line['quantity'],
                    'unit_price' => $line['unit_price'],
                    'tva_rate' => $tva,
                    'discount_percent' => $disc,
                    'total' => $ht,
                ]);
            }
        }

        $invoice->save();
        if ($invoice->invoiceLines()->exists()) {
            $this->invoiceService->recalculateTotals($invoice);
        }

        return response()->json($invoice->fresh()->load([
            'client', 'clientContact', 'orders', 'invoiceLines', 'billingAddress', 'deliveryAddress', 'pdfTemplate',
        ]));
    }

    public function destroy(Request $request, Invoice $invoice): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $invoice->delete();

        return response()->json(null, 204);
    }

    public function sendEmail(Request $request, Invoice $invoice): JsonResponse
    {
        $user = $request->user();
        if (! AgencyAccess::userMayAccessInvoice($user, $invoice)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        if (! $user->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'recipient_email' => 'nullable|email',
            'recipient_name' => 'nullable|string|max:100',
            'message' => 'nullable|string|max:2000',
            'pdf_template_id' => 'nullable|integer|exists:document_pdf_templates,id',
        ]);

        $invoice->loadMissing(['client', 'clientContact']);
        $recipientEmail = trim((string) ($validated['recipient_email'] ?? ''));
        $recipientName = trim((string) ($validated['recipient_name'] ?? ''));

        if ($recipientEmail === '' && $invoice->clientContact?->email) {
            $recipientEmail = trim((string) $invoice->clientContact->email);
        }
        if ($recipientName === '' && $invoice->clientContact) {
            $recipientName = trim(
                ($invoice->clientContact->prenom ?? '').' '.($invoice->clientContact->nom ?? '')
            );
        }
        if ($recipientEmail === '' && $invoice->client?->email) {
            $recipientEmail = trim((string) $invoice->client->email);
        }
        if ($recipientName === '' && $invoice->client?->name) {
            $recipientName = trim((string) $invoice->client->name);
        }

        if ($recipientEmail === '' || $recipientName === '') {
            return response()->json([
                'message' => 'Destinataire incomplet : email et nom du contact (ou du client) requis.',
            ], 422);
        }

        $mailer = (string) config('mail.default', 'log');
        if (in_array($mailer, ['log', 'array'], true)) {
            return response()->json([
                'message' => 'Envoi email impossible : le serveur SMTP n\'est pas configuré (MAIL_MAILER=smtp et identifiants SMTP dans .env.docker).',
            ], 503);
        }

        $subject = "Facture {$invoice->number} — ".\App\Support\AppDisplayName::resolve();

        try {
            Mail::to($recipientEmail)
                ->send(new InvoiceEmailMailable(
                    $invoice,
                    $recipientName,
                    $validated['message'] ?? null,
                    $user->name,
                    isset($validated['pdf_template_id']) ? (int) $validated['pdf_template_id'] : null,
                ));

            MailLog::create([
                'to' => $recipientEmail,
                'subject' => $subject,
                'template_name' => 'invoice_send',
                'status' => 'sent',
                'user_id' => $user->id,
                'sent_at' => now(),
            ]);
        } catch (\Throwable $e) {
            MailLog::create([
                'to' => $recipientEmail,
                'subject' => $subject,
                'template_name' => 'invoice_send',
                'status' => 'failed',
                'error_message' => $e->getMessage(),
                'user_id' => $user->id,
                'sent_at' => now(),
            ]);

            return response()->json(['message' => 'Échec de l\'envoi : '.$e->getMessage()], 500);
        }

        if ($invoice->status === Invoice::STATUS_DRAFT) {
            $invoice->update(['status' => Invoice::STATUS_SENT]);
        } elseif (! in_array($invoice->status, [Invoice::STATUS_PAID, Invoice::STATUS_RELANCED], true)) {
            $invoice->update(['status' => Invoice::STATUS_SENT]);
        }

        return response()->json([
            'message' => 'Facture envoyée par email.',
            'invoice' => $invoice->fresh()->load(['client', 'clientContact', 'invoiceLines', 'pdfTemplate']),
        ]);
    }

    public function sendReminder(Request $request, Invoice $invoice): JsonResponse
    {
        $user = $request->user();
        if (! $user->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        if (! AgencyAccess::userMayAccessInvoice($user, $invoice)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        if ($invoice->status === Invoice::STATUS_PAID) {
            return response()->json(['message' => 'Facture déjà encaissée.'], 422);
        }

        $validated = $request->validate([
            'note' => 'nullable|string|max:2000',
            'next_reminder_date' => 'nullable|date',
        ]);

        $invoice->loadMissing('client');
        $client = $invoice->client;
        $to = $client ? trim((string) ($client->email ?? '')) : '';

        $template = MailTemplate::query()->where('name', 'invoice_reminder')->first();
        $subject = $template?->subject ?? 'Rappel facture {{invoice_number}}';
        $body = $template?->body ?? "Bonjour,\n\nLa facture {{invoice_number}} est en retard (échéance {{due_date}}).\n\nCordialement";

        $replacements = [
            '{{invoice_number}}' => $invoice->number,
            '{{due_date}}' => $invoice->due_date?->format('d/m/Y') ?? '',
            '{{amount_ttc}}' => (string) $invoice->amount_ttc,
        ];
        foreach ($replacements as $k => $v) {
            $subject = str_replace($k, $v, $subject);
            $body = str_replace($k, $v, $body);
        }

        if (! empty($validated['note'])) {
            $body .= "\n\n".trim((string) $validated['note']);
        }

        $mailer = (string) config('mail.default', 'log');
        if ($to !== '' && ! in_array($mailer, ['log', 'array'], true)) {
            try {
                Mail::raw($body, function ($message) use ($to, $subject) {
                    $message->to($to)->subject($subject);
                });
                MailLog::create([
                    'to' => $to,
                    'subject' => $subject,
                    'template_name' => 'invoice_reminder',
                    'status' => 'sent',
                    'user_id' => $user->id,
                    'sent_at' => now(),
                ]);
            } catch (\Throwable $e) {
                MailLog::create([
                    'to' => $to,
                    'subject' => $subject,
                    'template_name' => 'invoice_reminder',
                    'status' => 'failed',
                    'error_message' => $e->getMessage(),
                    'user_id' => $user->id,
                    'sent_at' => now(),
                ]);

                return response()->json(['message' => 'Échec de la relance : '.$e->getMessage()], 500);
            }
        }

        $noteLine = now()->format('Y-m-d H:i').' — Relance';
        if (! empty($validated['note'])) {
            $noteLine .= ' : '.trim((string) $validated['note']);
        }
        if ($user->name) {
            $noteLine .= ' ('.$user->name.')';
        }
        $existingNotes = trim((string) ($invoice->reminder_notes ?? ''));
        $reminderNotes = $existingNotes === '' ? $noteLine : $existingNotes."\n".$noteLine;

        $invoice->update([
            'status' => Invoice::STATUS_RELANCED,
            'last_reminder_sent_at' => now(),
            'reminder_count' => (int) $invoice->reminder_count + 1,
            'reminder_notes' => $reminderNotes,
            'next_reminder_date' => $validated['next_reminder_date'] ?? now()->addDays(7)->toDateString(),
        ]);

        return response()->json([
            'message' => $to === '' ? 'Relance enregistrée (client sans email).' : 'Relance envoyée.',
            'invoice' => $invoice->fresh()->load(['client', 'clientContact', 'invoiceLines', 'pdfTemplate']),
        ]);
    }

    private function applyQuickFilter(Builder $query, Request $request): void
    {
        $qf = trim((string) $request->query('quick_filter', ''));
        if ($qf === '') {
            return;
        }

        match ($qf) {
            'unpaid' => $query->unpaid(),
            'overdue' => $query->unpaid()
                ->whereNotNull('due_date')
                ->whereDate('due_date', '<', now()->toDateString()),
            'relance' => $query->unpaid()->where(function (Builder $q) {
                $q->where(function (Builder $sub) {
                    $sub->whereNotNull('next_reminder_date')
                        ->whereDate('next_reminder_date', '<=', now()->toDateString());
                })->orWhere(function (Builder $sub) {
                    $sub->whereNotNull('due_date')
                        ->whereDate('due_date', '<', now()->toDateString());
                });
            }),
            default => null,
        };
    }

    private function applyInvoiceStatusFilter(Builder $query, Request $request): void
    {
        $statuses = $this->requestedInvoiceStatuses($request);
        if ($statuses === null || count($statuses) === 0) {
            return;
        }
        $allowed = Invoice::statuses();
        $filtered = array_values(array_intersect($statuses, $allowed));
        if (count($filtered) === 0) {
            return;
        }
        if (count($filtered) === 1) {
            $query->where('status', $filtered[0]);
        } else {
            $query->whereIn('status', $filtered);
        }
    }

    /**
     * @return list<string>|null null si le paramètre status est absent
     */
    private function requestedInvoiceStatuses(Request $request): ?array
    {
        if (! $request->has('status')) {
            return null;
        }
        $raw = $request->query('status');
        if ($raw === null || $raw === '') {
            return [];
        }
        if (is_array($raw)) {
            return array_values(array_filter(array_map('trim', $raw), fn ($s) => $s !== ''));
        }
        if (is_string($raw) && str_contains($raw, ',')) {
            return array_values(array_filter(array_map('trim', explode(',', $raw)), fn ($s) => $s !== ''));
        }
        if (is_string($raw)) {
            return [trim($raw)];
        }

        return [];
    }
}
