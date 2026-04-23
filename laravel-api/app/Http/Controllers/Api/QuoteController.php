<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agency;
use App\Models\Catalogue\Article;
use App\Models\Catalogue\Package;
use App\Models\DevisTache;
use App\Models\DocumentStatusHistory;
use App\Models\Dossier;
use App\Models\Quote;
use App\Models\QuoteLine;
use App\Models\Site;
use App\Services\CommercialDocumentTotalsService;
use App\Services\DocumentStatusService;
use App\Support\AgencyAccess;
use App\Support\ClientContactDocument;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class QuoteController extends Controller
{
    private const QUOTE_LINE_BASE = [
        'lines.*.commercial_offering_id' => 'nullable|exists:commercial_offerings,id',
        'lines.*.ref_article_id' => 'nullable|exists:ref_articles,id',
        'lines.*.ref_package_id' => 'nullable|exists:ref_packages,id',
        'lines.*.description' => 'required|string|max:500',
        'lines.*.quantity' => 'required|integer|min:1',
        'lines.*.unit_price' => 'required|numeric|min:0',
        'lines.*.tva_rate' => 'nullable|numeric|min:0|max:100',
        'lines.*.discount_percent' => 'nullable|numeric|min:0|max:100',
        'lines.*.type_ligne' => 'nullable|string|in:libre,catalogue,commentaire',
        'lines.*.line_code' => 'nullable|string|max:64',
    ];

    private const TACHES_RULES = [
        'taches' => 'nullable|array',
        'taches.*.ref_tache_id' => 'required|exists:ref_taches,id',
        'taches.*.libelle' => 'nullable|string|max:255',
        'taches.*.quantite' => 'required|integer|min:1',
        'taches.*.prix_unitaire_ht' => 'required|numeric|min:0',
        'taches.*.statut' => 'required|string|in:a_faire,en_cours,termine,annule',
        'taches.*.ordre' => 'nullable|integer|min:0',
    ];

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Quote::query()->with([
            'client',
            'clientContact',
            'agency',
            'site',
            'dossier',
            'quoteLines.commercialOffering',
            'quoteLines.refArticle',
            'quoteLines.refPackage',
            'billingAddress',
            'deliveryAddress',
            'pdfTemplate',
        ]);

        if (! $user->isLab()) {
            AgencyAccess::applyQuoteScope($query, $user);
        }

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('number', 'like', '%'.$search.'%')
                    ->orWhere('notes', 'like', '%'.$search.'%')
                    ->orWhereHas('client', function ($cq) use ($search) {
                        $cq->where('name', 'like', '%'.$search.'%');
                    });
            });
        }

        if ($status = trim((string) $request->query('status', ''))) {
            $query->where('status', $status);
        }

        $quotes = $query->orderByDesc('quote_date')->paginate(15);

        return response()->json($quotes);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate(array_merge([
            'client_id' => 'required|exists:clients,id',
            'site_id' => 'nullable|exists:sites,id',
            'dossier_id' => 'nullable|exists:dossiers,id',
            'contact_id' => 'nullable|exists:client_contacts,id',
            'quote_date' => 'required|date',
            'order_date' => 'nullable|date',
            'site_delivery_date' => 'nullable|date',
            'valid_until' => 'nullable|date',
            'tva_rate' => 'nullable|numeric|min:0|max:100',
            'discount_percent' => 'nullable|numeric|min:0|max:100',
            'discount_amount' => 'nullable|numeric|min:0',
            'shipping_amount_ht' => 'nullable|numeric|min:0',
            'shipping_tva_rate' => 'nullable|numeric|min:0|max:100',
            'billing_address_id' => 'nullable|exists:client_addresses,id',
            'delivery_address_id' => 'nullable|exists:client_addresses,id',
            'pdf_template_id' => 'nullable|exists:document_pdf_templates,id',
            'notes' => 'nullable|string',
            'travel_fee_ht' => 'nullable|numeric|min:0',
            'travel_fee_tva_rate' => 'nullable|numeric|min:0|max:100',
            'apply_site_travel' => 'nullable|boolean',
            'meta' => 'nullable|array',
        ], [
            'lines' => 'required|array|min:1',
        ], self::QUOTE_LINE_BASE, self::TACHES_RULES));

        $this->assertDossierForClient(
            (int) $validated['client_id'],
            isset($validated['dossier_id']) ? (int) $validated['dossier_id'] : null,
            isset($validated['site_id']) ? (int) $validated['site_id'] : null,
        );
        ClientContactDocument::assertBelongsToClient(
            isset($validated['contact_id']) ? (int) $validated['contact_id'] : null,
            (int) $validated['client_id'],
        );
        $this->assertLinesNoDualRef($validated['lines']);

        $number = 'DEV-'.Carbon::now()->format('Ymd').'-'.str_pad((string) (Quote::count() + 1), 4, '0', STR_PAD_LEFT);
        $defaultTva = $validated['tva_rate'] ?? 20;

        $travelHt = (float) ($validated['travel_fee_ht'] ?? 0);
        if (! empty($validated['apply_site_travel']) && ! empty($validated['site_id'])) {
            $site = Site::find($validated['site_id']);
            if ($site) {
                $travelHt = (float) $site->travel_fee_quote_ht;
            }
        }

        $cid = (int) $validated['client_id'];
        $agencyId = null;
        if (! empty($validated['site_id'])) {
            $site = Site::query()->find((int) $validated['site_id']);
            if ($site && (int) $site->client_id === $cid) {
                $agencyId = $site->agency_id;
            }
        }
        if (! $agencyId) {
            $agencyId = Agency::query()->where('client_id', $cid)->where('is_headquarters', true)->value('id');
        }

        $quote = Quote::create([
            'number' => $number,
            'client_id' => $validated['client_id'],
            'contact_id' => $validated['contact_id'] ?? null,
            'agency_id' => $agencyId,
            'site_id' => $validated['site_id'] ?? null,
            'dossier_id' => $validated['dossier_id'] ?? null,
            'quote_date' => $validated['quote_date'],
            'order_date' => $validated['order_date'] ?? null,
            'site_delivery_date' => $validated['site_delivery_date'] ?? null,
            'valid_until' => $validated['valid_until'] ?? null,
            'amount_ht' => 0,
            'amount_ttc' => 0,
            'tva_rate' => $defaultTva,
            'discount_percent' => $validated['discount_percent'] ?? 0,
            'discount_amount' => $validated['discount_amount'] ?? 0,
            'shipping_amount_ht' => $validated['shipping_amount_ht'] ?? 0,
            'shipping_tva_rate' => $validated['shipping_tva_rate'] ?? 20,
            'travel_fee_ht' => $travelHt,
            'travel_fee_tva_rate' => $validated['travel_fee_tva_rate'] ?? 20,
            'billing_address_id' => $validated['billing_address_id'] ?? null,
            'delivery_address_id' => $validated['delivery_address_id'] ?? null,
            'pdf_template_id' => $validated['pdf_template_id'] ?? null,
            'status' => Quote::STATUS_DRAFT,
            'notes' => $validated['notes'] ?? null,
            'meta' => $validated['meta'] ?? null,
        ]);

        $this->syncQuoteLines($quote, $validated['lines'], (float) $defaultTva);
        $this->recalculateQuoteTotals($quote);
        if (array_key_exists('taches', $validated)) {
            $this->syncDevisTaches($quote, $validated['taches'] ?? []);
        }

        return response()->json($this->loadQuoteForResponse($quote->fresh()), 201);
    }

    public function show(Request $request, Quote $quote): JsonResponse
    {
        $user = $request->user();
        if (! AgencyAccess::userMayAccessQuote($user, $quote)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        return response()->json($this->loadQuoteForResponse($quote));
    }

    public function update(Request $request, Quote $quote): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $oldStatus = $quote->status;
        $statusRule = Rule::in(Quote::statuses());

        if ($quote->status !== Quote::STATUS_DRAFT) {
            $validated = $request->validate([
                'status' => ['sometimes', $statusRule],
                'notes' => 'nullable|string',
                'pdf_template_id' => 'nullable|exists:document_pdf_templates,id',
                'meta' => 'nullable|array',
                'contact_id' => 'nullable|exists:client_contacts,id',
            ]);
            $quote->fill($validated);
            ClientContactDocument::assertBelongsToClient(
                $quote->contact_id,
                (int) $quote->client_id,
            );
            $quote->save();
            $this->recordQuoteStatusChange($quote, $oldStatus, $request);

            return response()->json($this->loadQuoteForResponse($quote->fresh()));
        }

        $validated = $request->validate(array_merge([
            'client_id' => 'sometimes|exists:clients,id',
            'site_id' => 'nullable|exists:sites,id',
            'dossier_id' => 'nullable|exists:dossiers,id',
            'contact_id' => 'nullable|exists:client_contacts,id',
            'quote_date' => 'sometimes|date',
            'order_date' => 'nullable|date',
            'site_delivery_date' => 'nullable|date',
            'valid_until' => 'nullable|date',
            'tva_rate' => 'nullable|numeric|min:0|max:100',
            'discount_percent' => 'nullable|numeric|min:0|max:100',
            'discount_amount' => 'nullable|numeric|min:0',
            'shipping_amount_ht' => 'nullable|numeric|min:0',
            'shipping_tva_rate' => 'nullable|numeric|min:0|max:100',
            'billing_address_id' => 'nullable|exists:client_addresses,id',
            'delivery_address_id' => 'nullable|exists:client_addresses,id',
            'pdf_template_id' => 'nullable|exists:document_pdf_templates,id',
            'status' => ['sometimes', $statusRule],
            'notes' => 'nullable|string',
            'travel_fee_ht' => 'nullable|numeric|min:0',
            'travel_fee_tva_rate' => 'nullable|numeric|min:0|max:100',
            'apply_site_travel' => 'nullable|boolean',
            'meta' => 'nullable|array',
        ], [
            'lines' => 'sometimes|array|min:1',
        ], self::QUOTE_LINE_BASE, self::TACHES_RULES));

        $fill = collect($validated)->except(['lines', 'apply_site_travel', 'taches'])->toArray();
        if (! empty($validated['apply_site_travel']) && ($validated['site_id'] ?? $quote->site_id)) {
            $sid = $validated['site_id'] ?? $quote->site_id;
            $site = Site::find($sid);
            if ($site) {
                $fill['travel_fee_ht'] = (float) $site->travel_fee_quote_ht;
            }
        }
        $quote->fill($fill);

        if (array_key_exists('site_id', $fill) || array_key_exists('client_id', $fill)) {
            $cid = (int) $quote->client_id;
            $agencyId = null;
            if ($quote->site_id) {
                $agencyId = Site::query()->whereKey($quote->site_id)->value('agency_id');
            }
            if (! $agencyId) {
                $agencyId = Agency::query()->where('client_id', $cid)->where('is_headquarters', true)->value('id');
            }
            if ($agencyId) {
                $quote->agency_id = $agencyId;
            }
        }

        $this->assertDossierForClient(
            (int) $quote->client_id,
            $quote->dossier_id ? (int) $quote->dossier_id : null,
            $quote->site_id ? (int) $quote->site_id : null,
        );
        ClientContactDocument::assertBelongsToClient(
            $quote->contact_id,
            (int) $quote->client_id,
        );

        if (isset($validated['lines'])) {
            $this->assertLinesNoDualRef($validated['lines']);
            $defaultTva = $validated['tva_rate'] ?? $quote->tva_rate;
            $quote->quoteLines()->delete();
            $this->syncQuoteLines($quote, $validated['lines'], (float) $defaultTva);
        }

        if (array_key_exists('taches', $validated)) {
            $this->syncDevisTaches($quote, $validated['taches'] ?? []);
        }

        $quote->save();
        $this->recalculateQuoteTotals($quote);
        $this->recordQuoteStatusChange($quote->fresh(), $oldStatus, $request);

        return response()->json($this->loadQuoteForResponse($quote->fresh()));
    }

    public function destroy(Request $request, Quote $quote): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $quote->delete();

        return response()->json(null, 204);
    }

    private function loadQuoteForResponse(Quote $quote): Quote
    {
        return $quote->load([
            'client', 'clientContact', 'agency', 'site', 'dossier',
            'quoteLines.commercialOffering',
            'quoteLines.refArticle',
            'quoteLines.refPackage',
            'devisTaches.refTache',
            'billingAddress', 'deliveryAddress', 'pdfTemplate', 'attachments',
        ]);
    }

    /**
     * @param  array<int, array<string, mixed>>  $lines
     */
    private function assertLinesNoDualRef(array $lines): void
    {
        foreach ($lines as $i => $line) {
            if (! empty($line['ref_article_id']) && ! empty($line['ref_package_id'])) {
                abort(422, 'Une ligne de devis ne peut pas lier à la fois un article et un forfait (package) catalogue.');
            }
        }
    }

    private function recordQuoteStatusChange(Quote $quote, string $oldStatus, Request $request): void
    {
        if ($oldStatus === $quote->status) {
            return;
        }
        app(DocumentStatusService::class)->record(
            Quote::class,
            (int) $quote->id,
            $oldStatus,
            (string) $quote->status,
            $request->user(),
            DocumentStatusHistory::SOURCE_API,
        );
    }

    private function assertDossierForClient(int $clientId, ?int $dossierId, ?int $siteId): void
    {
        if (! $dossierId) {
            return;
        }
        $d = Dossier::query()->find($dossierId);
        if (! $d || (int) $d->client_id !== $clientId) {
            abort(422, 'Dossier invalide pour ce client.');
        }
        if ($siteId && $d->site_id && (int) $d->site_id !== $siteId) {
            abort(422, 'Le dossier ne correspond pas au chantier du devis.');
        }
    }

    /**
     * @param  array<int, array<string, mixed>>  $taches
     */
    private function syncDevisTaches(Quote $quote, array $taches): void
    {
        DevisTache::query()->where('quote_id', $quote->id)->forceDelete();
        foreach ($taches as $i => $row) {
            DevisTache::query()->create([
                'quote_id' => $quote->id,
                'ref_tache_id' => (int) $row['ref_tache_id'],
                'libelle' => $row['libelle'] ?? null,
                'quantite' => (int) ($row['quantite'] ?? 1),
                'prix_unitaire_ht' => $row['prix_unitaire_ht'],
                'statut' => (string) ($row['statut'] ?? DevisTache::STATUT_A_FAIRE),
                'ordre' => (int) ($row['ordre'] ?? $i),
            ]);
        }
    }

    /**
     * @param  array<int, array<string, mixed>>  $lines
     */
    private function syncQuoteLines(Quote $quote, array $lines, float $defaultTva): void
    {
        foreach ($lines as $line) {
            $tva = isset($line['tva_rate']) ? (float) $line['tva_rate'] : $defaultTva;
            $disc = isset($line['discount_percent']) ? (float) $line['discount_percent'] : 0;
            $refArticleId = ! empty($line['ref_article_id']) ? (int) $line['ref_article_id'] : null;
            $refPackageId = ! empty($line['ref_package_id']) ? (int) $line['ref_package_id'] : null;
            $description = (string) $line['description'];
            $unit = (float) $line['unit_price'];

            if ($refPackageId) {
                $p = Package::query()->find($refPackageId);
                if ($p) {
                    if (trim($description) === '') {
                        $description = (string) $p->libelle;
                    }
                    if ($unit <= 0) {
                        $unit = (float) $p->prix_ht;
                    }
                    if (! isset($line['tva_rate']) && $p->tva_rate !== null) {
                        $tva = (float) $p->tva_rate;
                    }
                }
                $refArticleId = null;
            } elseif ($refArticleId) {
                $a = Article::query()->find($refArticleId);
                if ($a) {
                    if (trim($description) === '') {
                        $description = (string) $a->libelle;
                    }
                    if ($unit <= 0) {
                        $unit = (float) $a->prix_unitaire_ht;
                    }
                    if (! isset($line['tva_rate']) && $a->tva_rate !== null) {
                        $tva = (float) $a->tva_rate;
                    }
                }
            }

            $ht = CommercialDocumentTotalsService::lineHt(
                (float) $line['quantity'],
                $unit,
                $disc,
            );
            $typeLigne = $line['type_ligne'] ?? null;
            if ($typeLigne === null) {
                $typeLigne = ($refArticleId || $refPackageId || ! empty($line['commercial_offering_id'])) ? 'catalogue' : 'libre';
            }
            QuoteLine::create([
                'quote_id' => $quote->id,
                'commercial_offering_id' => isset($line['commercial_offering_id']) ? (int) $line['commercial_offering_id'] : null,
                'ref_article_id' => $refArticleId,
                'ref_package_id' => $refPackageId,
                'type_ligne' => $typeLigne,
                'line_code' => isset($line['line_code']) ? (string) $line['line_code'] : null,
                'description' => $description,
                'quantity' => (int) $line['quantity'],
                'unit_price' => $unit,
                'tva_rate' => $tva,
                'discount_percent' => $disc,
                'total' => $ht,
            ]);
        }
    }

    private function recalculateQuoteTotals(Quote $quote): void
    {
        $quote->load('quoteLines');
        $lines = [];
        foreach ($quote->quoteLines as $ql) {
            $lines[] = [
                'ht' => (float) $ql->total,
                'tva_rate' => (float) $ql->tva_rate,
            ];
        }

        $totals = CommercialDocumentTotalsService::computeTotals(
            $lines,
            (float) $quote->discount_percent,
            (float) $quote->discount_amount,
            (float) $quote->shipping_amount_ht,
            (float) $quote->shipping_tva_rate,
            (float) $quote->travel_fee_ht,
            (float) $quote->travel_fee_tva_rate,
        );

        $quote->update([
            'amount_ht' => $totals['amount_ht'],
            'amount_ttc' => $totals['amount_ttc'],
        ]);
    }
}
