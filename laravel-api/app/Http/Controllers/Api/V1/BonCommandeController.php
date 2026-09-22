<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\BcLignePlanningAffectation;
use App\Models\BonCommande;
use App\Models\BonCommandeLigne;
use App\Models\Quote;
use App\Services\BonCommandeTotalsService;
use App\Services\BonLivraisonDeliveryService;
use App\Services\CommercialDocumentTotalsService;
use App\Services\CommercialDocumentWorkflowService;
use App\Services\TerrainPlanningBcLinesService;
use App\Support\AgencyAccess;
use App\Support\ClientContactDocument;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BonCommandeController extends Controller
{
    public function __construct(
        private readonly CommercialDocumentWorkflowService $workflow,
        private readonly BonLivraisonDeliveryService $delivery,
        private readonly BonCommandeTotalsService $totals,
        private readonly TerrainPlanningBcLinesService $terrainPlanningLines,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $unassignedPlanning = $request->boolean('planning_unassigned');
        $relations = ['dossier', 'client', 'clientContact', 'quote'];
        $relations['lignes'] = $unassignedPlanning
            ? fn ($query) => $query->whereDoesntHave('planningAffectations')->orderBy('ordre')->orderBy('id')
            : fn ($query) => $query->orderBy('ordre')->orderBy('id');

        $q = BonCommande::query()
            ->with($relations)
            ->withCount(['bonsLivraison', 'invoices'])
            ->orderByDesc('date_commande')
            ->orderByDesc('id');
        if ($request->filled('dossier_id')) {
            $q->where('dossier_id', (int) $request->query('dossier_id'));
        }
        if ($request->filled('client_id')) {
            $q->where('client_id', (int) $request->query('client_id'));
        }
        if ($request->filled('statut')) {
            $q->where('statut', (string) $request->query('statut'));
        }
        if ($request->boolean('planning')) {
            $q->planifiable();
        }
        if ($unassignedPlanning) {
            $q->planifiable()
                ->whereHas('lignes', fn ($query) => $query->whereDoesntHave('planningAffectations'));
        }
        if ($search = trim((string) $request->query('search', ''))) {
            $like = '%'.$search.'%';
            $q->where(function ($sub) use ($like) {
                $sub->where('numero', 'like', $like)
                    ->orWhereHas('client', fn ($cq) => $cq->where('name', 'like', $like))
                    ->orWhereHas('dossier', function ($dq) use ($like) {
                        $dq->where('reference', 'like', $like)
                            ->orWhere('titre', 'like', $like);
                    })
                    ->orWhereHas('quote', fn ($qq) => $qq->where('number', 'like', $like));
            });
        }
        if ($request->user()->isLab()) {
            $rows = $q->get();
            if ($unassignedPlanning) {
                $rows = $rows
                    ->filter(fn (BonCommande $bonCommande) => $this->terrainPlanningLines->prepare($bonCommande))
                    ->values();
            }

            return response()->json($rows);
        }
        if (! $request->user()->client_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        $q->where('client_id', $request->user()->client_id);

        return response()->json($q->get());
    }

    public function show(Request $request, BonCommande $bonCommande): JsonResponse
    {
        if (! AgencyAccess::userMayAccessBonCommande($request->user(), $bonCommande)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        $this->totals->synchronize($bonCommande);
        $bonCommande->load([
            'lignes.planningAffectations.user',
            'lignes.technicien',
            'dossier.centreGroup',
            'centreGroup',
            'client',
            'clientContact',
            'quote',
            'bonsLivraison.lignes',
        ]);

        return response()->json($bonCommande);
    }

    public function update(Request $request, BonCommande $bonCommande): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        if (! AgencyAccess::userMayAccessBonCommande($request->user(), $bonCommande)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $data = $request->validate([
            'notes' => 'sometimes|nullable|string',
            'date_livraison_prevue' => 'sometimes|nullable|date',
            'montant_ht' => 'sometimes|numeric|min:0',
            'montant_ttc' => 'sometimes|numeric|min:0',
            'contact_id' => 'sometimes|nullable|exists:client_contacts,id',
            'statut' => 'sometimes|string|in:brouillon,confirme,en_cours,livre,annule',
            'lab_centre_group_id' => 'sometimes|nullable|integer|exists:lab_centre_groups,id',
        ]);
        if ($data !== []) {
            $bonCommande->update($data);
            $bonCommande->refresh();
            ClientContactDocument::assertBelongsToClient($bonCommande->contact_id, (int) $bonCommande->client_id);
        }

        return response()->json($bonCommande->fresh()->load([
            'lignes.planningAffectations.user',
            'dossier.centreGroup',
            'centreGroup',
            'client',
            'clientContact',
        ]));
    }

    public function destroy(Request $request, BonCommande $bonCommande): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        if (! AgencyAccess::userMayAccessBonCommande($request->user(), $bonCommande)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        if ($bonCommande->bonsLivraison()->exists()) {
            return response()->json(['message' => 'Impossible de supprimer un BC qui possède déjà un BL.'], 422);
        }

        $bonCommande->delete();

        return response()->json(null, 204);
    }

    public function updateLigne(
        Request $request,
        BonCommande $bonCommande,
        BonCommandeLigne $ligne
    ): JsonResponse {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        if (! AgencyAccess::userMayAccessBonCommande($request->user(), $bonCommande)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        if ((int) $ligne->bon_commande_id !== (int) $bonCommande->id) {
            return response()->json(['message' => 'Ligne introuvable pour ce bon de commande.'], 404);
        }

        if ($bonCommande->statut === BonCommande::STATUT_ANNULE) {
            return response()->json(['message' => 'Impossible de modifier un bon de commande annulé.'], 422);
        }

        $data = $request->validate([
            'date_debut_prevue' => 'sometimes|nullable|date',
            'date_fin_prevue' => 'sometimes|nullable|date',
            'technicien_id' => 'sometimes|nullable|integer|exists:users,id',
            'date_livraison' => 'sometimes|nullable|date',
            'notes_ligne' => 'sometimes|nullable|string|max:500',
            'quantite' => 'sometimes|numeric|min:0',
            'prix_unitaire_ht' => 'sometimes|numeric|min:0',
        ]);
        if ($data === []) {
            $ligne->load(['planningAffectations.user', 'technicien']);

            return response()->json($ligne);
        }
        if (array_key_exists('date_debut_prevue', $data)) {
            $ligne->date_debut_prevue = $data['date_debut_prevue'];
        }
        if (array_key_exists('date_fin_prevue', $data)) {
            $ligne->date_fin_prevue = $data['date_fin_prevue'];
        }
        if (array_key_exists('technicien_id', $data)) {
            $ligne->technicien_id = $data['technicien_id'];
        }
        if (array_key_exists('date_livraison', $data)) {
            $ligne->date_livraison = $data['date_livraison'];
        }
        if (array_key_exists('notes_ligne', $data)) {
            $ligne->notes_ligne = $data['notes_ligne'];
        }
        if ($ligne->date_debut_prevue) {
            if (! $ligne->date_fin_prevue) {
                $ligne->date_fin_prevue = $ligne->date_debut_prevue;
            }
            if (! $ligne->date_livraison) {
                $ligne->date_livraison = $ligne->date_debut_prevue;
            }
        }
        $qtyChanged = false;
        if (array_key_exists('quantite', $data)) {
            $qty = round((float) $data['quantite'], 3);
            $dejaLivree = $this->delivery->deliveredQtyForBcLigne((int) $ligne->id);
            if ($qty + 1e-9 < $dejaLivree) {
                $minLabel = $this->formatQtyLabel($dejaLivree);

                return response()->json([
                    'message' => "La quantité ne peut pas être inférieure à la quantité déjà livrée ({$minLabel}).",
                ], 422);
            }
            $ligne->quantite = $qty;
            $qtyChanged = true;
        }
        if (array_key_exists('prix_unitaire_ht', $data)) {
            $ligne->prix_unitaire_ht = round((float) $data['prix_unitaire_ht'], 4);
            $qtyChanged = true;
        }
        if ($qtyChanged) {
            $ligne->montant_ht = CommercialDocumentTotalsService::lineHt(
                (float) $ligne->quantite,
                (float) $ligne->prix_unitaire_ht,
                0,
            );
        }
        if ($ligne->date_debut_prevue && $ligne->date_fin_prevue
            && $ligne->date_debut_prevue->format('Y-m-d') > $ligne->date_fin_prevue->format('Y-m-d')
        ) {
            return response()->json(['message' => 'La date de début ne peut pas être postérieure à la date de fin.'], 422);
        }

        $ligne->save();
        if ($qtyChanged) {
            $this->recalculateBonCommandeTotals($bonCommande);
        }
        $this->syncTerrainPlanningAffectation($ligne, (int) $request->user()->id);
        $ligne->load(['planningAffectations.user', 'technicien']);

        return response()->json($ligne);
    }

    private function recalculateBonCommandeTotals(BonCommande $bonCommande): void
    {
        $this->totals->synchronize($bonCommande);
    }

    private function formatQtyLabel(float $qty): string
    {
        if (abs($qty - round($qty)) < 1e-9) {
            return (string) (int) round($qty);
        }

        return rtrim(rtrim(number_format($qty, 3, '.', ''), '0'), '.');
    }

    private function syncTerrainPlanningAffectation(BonCommandeLigne $ligne, int $actorId): void
    {
        $ligne->refresh();

        if (! $ligne->technicien_id || ! $ligne->date_debut_prevue) {
            return;
        }

        $dateFin = $ligne->date_fin_prevue ?? $ligne->date_debut_prevue;

        BcLignePlanningAffectation::query()->updateOrCreate(
            [
                'bon_commande_ligne_id' => $ligne->id,
                'user_id' => $ligne->technicien_id,
            ],
            [
                'date_debut' => $ligne->date_debut_prevue->format('Y-m-d'),
                'date_fin' => $dateFin->format('Y-m-d'),
                'notes' => $ligne->notes_ligne,
                'created_by' => $actorId,
            ]
        );
    }

    public function syncPrixDevis(Request $request, BonCommande $bonCommande): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        if (! AgencyAccess::userMayAccessBonCommande($request->user(), $bonCommande)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        if ($bonCommande->statut === BonCommande::STATUT_ANNULE) {
            return response()->json(['message' => 'Impossible de modifier un bon de commande annulé.'], 422);
        }
        if (! $bonCommande->quote_id) {
            return response()->json(['message' => 'Ce bon de commande n\'est pas lié à un devis.'], 422);
        }

        $quote = Quote::with('quoteLines')->find($bonCommande->quote_id);
        if (! $quote) {
            return response()->json(['message' => 'Devis introuvable.'], 422);
        }

        $bonCommande->load('lignes');
        $quoteLines = $quote->quoteLines->sortBy('order')->values();
        $bcLignes = $bonCommande->lignes->sortBy('ordre')->values();

        $updated = 0;
        foreach ($bcLignes as $idx => $ligne) {
            $ql = $quoteLines[$idx] ?? null;
            if (! $ql) {
                continue;
            }
            $prix = round((float) $ql->unit_price, 4);
            if ($prix <= 0) {
                continue;
            }
            $ligne->prix_unitaire_ht = $prix;
            $ligne->montant_ht = CommercialDocumentTotalsService::lineHt(
                (float) $ligne->quantite,
                $prix,
                0,
            );
            $ligne->save();
            $updated++;
        }

        if ($updated > 0) {
            $this->recalculateBonCommandeTotals($bonCommande);
        }

        $bonCommande->refresh()->load([
            'lignes.planningAffectations.user',
            'lignes.technicien',
            'dossier',
            'client',
            'clientContact',
            'quote',
            'bonsLivraison.lignes',
        ]);

        return response()->json($bonCommande);
    }

    public function confirmer(Request $request, BonCommande $bonCommande): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        if (! AgencyAccess::userMayAccessBonCommande($request->user(), $bonCommande)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        if ($bonCommande->statut !== BonCommande::STATUT_BROUILLON) {
            return response()->json(['message' => 'Seul un BC en brouillon peut être confirmé.'], 422);
        }
        $bonCommande->update(['statut' => BonCommande::STATUT_CONFIRME]);

        return response()->json($bonCommande->fresh()->load('lignes'));
    }

    public function transformerBl(Request $request, BonCommande $bonCommande): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        if (! AgencyAccess::userMayAccessBonCommande($request->user(), $bonCommande)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        try {
            $bl = $this->workflow->createBonLivraisonFromBonCommande($bonCommande, $request->user());
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json($bl->load(['dossier', 'client', 'lignes']), 201);
    }
}
