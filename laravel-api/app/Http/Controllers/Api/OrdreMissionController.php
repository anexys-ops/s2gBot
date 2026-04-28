<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BonCommande;
use App\Models\BonCommandeLigne;
use App\Models\FraisDeplacement;
use App\Models\OrdreMission;
use App\Models\OrdreMissionLigne;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OrdreMissionController extends Controller
{
    private const WITH = [
        'client:id,name',
        'site:id,name',
        'responsable:id,name',
        'bonCommande:id,numero',
        'lignes.assignedUser:id,name',
        'lignes.equipment:id,name,code',
        'lignes.articleAction',
        'lignes.article:id,code,libelle',
    ];

    public function index(Request $request): JsonResponse
    {
        $q = OrdreMission::with(['client:id,name', 'responsable:id,name', 'bonCommande:id,numero']);

        if ($type = $request->query('type')) {
            $q->where('type', $type);
        }
        if ($statut = $request->query('statut')) {
            $q->where('statut', $statut);
        }
        if ($bcId = $request->query('bon_commande_id')) {
            $q->where('bon_commande_id', $bcId);
        }
        if ($from = $request->query('date_from')) {
            $q->where('date_prevue', '>=', $from);
        }
        if ($to = $request->query('date_to')) {
            $q->where('date_prevue', '<=', $to);
        }

        return response()->json(
            $q->orderByDesc('id')->get()
        );
    }

    public function show(OrdreMission $ordreMission): JsonResponse
    {
        return response()->json(
            $ordreMission->load(self::WITH)
        );
    }

    /**
     * Génère automatiquement les 3 ordres de mission depuis un bon de commande.
     * Si des OMs existent déjà pour ce BC, on les recrée (sync).
     */
    public function generateFromBC(Request $request, BonCommande $bonCommande): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $bc = $bonCommande->load(['lignes.article.actions', 'lignes.article.equipmentRequirements']);

        $orders = DB::transaction(function () use ($bc, $request) {
            $created = [];

            foreach ([OrdreMission::TYPE_LABO, OrdreMission::TYPE_TECHNICIEN, OrdreMission::TYPE_INGENIEUR] as $type) {
                // Filtrer les lignes qui ont des actions pour ce type
                $lignesAvecActions = $bc->lignes->filter(function (BonCommandeLigne $ligne) use ($type) {
                    if (! $ligne->article) {
                        return false;
                    }

                    return $ligne->article->actions->where('type', $type)->isNotEmpty();
                });

                if ($lignesAvecActions->isEmpty()) {
                    continue; // Pas d'actions de ce type → pas d'OM
                }

                /** @var OrdreMission $om */
                $om = OrdreMission::create([
                    'numero'          => OrdreMission::nextNumero($type),
                    'bon_commande_id' => $bc->id,
                    'dossier_id'      => $bc->dossier_id,
                    'client_id'       => $bc->client_id,
                    'site_id'         => $bc->dossier?->site_id,
                    'type'            => $type,
                    'statut'          => OrdreMission::STATUT_BROUILLON,
                    'date_prevue'     => $bc->date_livraison_prevue,
                    'created_by'      => $request->user()->id,
                ]);

                $ordre = 0;
                foreach ($lignesAvecActions as $ligne) {
                    foreach ($ligne->article->actions->where('type', $type) as $action) {
                        OrdreMissionLigne::create([
                            'ordre_mission_id'      => $om->id,
                            'bon_commande_ligne_id' => $ligne->id,
                            'ref_article_id'        => $ligne->ref_article_id,
                            'article_action_id'     => $action->id,
                            'libelle'               => $action->libelle,
                            'quantite'              => $ligne->quantite,
                            'statut'                => 'a_faire',
                            'ordre'                 => $ordre++,
                        ]);
                    }
                }

                $created[] = $om->load(self::WITH);
            }

            return $created;
        });

        return response()->json($orders, 201);
    }

    public function update(Request $request, OrdreMission $ordreMission): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'statut'         => 'sometimes|in:brouillon,planifie,en_cours,termine,annule',
            'date_prevue'    => 'nullable|date',
            'date_debut'     => 'nullable|date',
            'date_fin'       => 'nullable|date',
            'responsable_id' => 'nullable|exists:users,id',
            'notes'          => 'nullable|string',
        ]);

        $ordreMission->update($validated);

        return response()->json($ordreMission->fresh()->load(self::WITH));
    }

    public function destroy(Request $request, OrdreMission $ordreMission): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $ordreMission->delete();

        return response()->json(null, 204);
    }

    // ── Lignes ───────────────────────────────────────────────────────────────

    public function updateLigne(Request $request, OrdreMission $ordreMission, OrdreMissionLigne $ligne): JsonResponse
    {
        abort_if($ligne->ordre_mission_id !== $ordreMission->id, 404);

        $validated = $request->validate([
            'statut'              => 'sometimes|in:a_faire,en_cours,realise,annule',
            'assigned_user_id'    => 'nullable|exists:users,id',
            'equipment_id'        => 'nullable|exists:equipments,id',
            'date_prevue'         => 'nullable|date',
            'date_realisation'    => 'nullable|date',
            'duree_reelle_heures' => 'nullable|integer|min:0',
            'notes'               => 'nullable|string',
        ]);

        $ligne->update($validated);

        return response()->json($ligne->fresh()->load(['assignedUser:id,name', 'equipment:id,name,code']));
    }

    // ── Planning ─────────────────────────────────────────────────────────────

    public function planning(Request $request): JsonResponse
    {
        $from = $request->query('from', now()->startOfMonth()->toDateString());
        $to   = $request->query('to', now()->endOfMonth()->toDateString());
        $type = $request->query('type'); // labo|technicien|ingenieur

        $q = OrdreMission::with([
            'client:id,name',
            'responsable:id,name',
            'lignes.assignedUser:id,name',
            'lignes.equipment:id,name,code',
        ])
            ->whereBetween('date_prevue', [$from, $to])
            ->whereIn('statut', ['planifie', 'en_cours', 'brouillon']);

        if ($type) {
            $q->where('type', $type);
        }

        return response()->json($q->orderBy('date_prevue')->get());
    }

    // ── Frais de déplacement ─────────────────────────────────────────────────

    public function fraisIndex(OrdreMission $ordreMission): JsonResponse
    {
        return response()->json(
            $ordreMission->fraisDeplacement()->with('user:id,name')->get()
        );
    }

    public function fraisStore(Request $request, OrdreMission $ordreMission): JsonResponse
    {
        $validated = $request->validate([
            'user_id'         => 'required|exists:users,id',
            'date'            => 'required|date',
            'lieu_depart'     => 'nullable|string|max:255',
            'lieu_arrivee'    => 'nullable|string|max:255',
            'distance_km'     => 'required|numeric|min:0',
            'taux_km'         => 'nullable|numeric|min:0',
            'type_transport'  => 'nullable|in:voiture,moto,velo,transports_commun,autre',
            'notes'           => 'nullable|string',
        ]);

        $frais = $ordreMission->fraisDeplacement()->create($validated);

        return response()->json($frais->load('user:id,name'), 201);
    }

    public function fraisUpdate(Request $request, OrdreMission $ordreMission, FraisDeplacement $frais): JsonResponse
    {
        abort_if($frais->ordre_mission_id !== $ordreMission->id, 404);

        $validated = $request->validate([
            'date'           => 'sometimes|date',
            'lieu_depart'    => 'nullable|string|max:255',
            'lieu_arrivee'   => 'nullable|string|max:255',
            'distance_km'    => 'sometimes|numeric|min:0',
            'taux_km'        => 'nullable|numeric|min:0',
            'type_transport' => 'nullable|in:voiture,moto,velo,transports_commun,autre',
            'notes'          => 'nullable|string',
            'statut'         => 'sometimes|in:draft,valide,rembourse',
        ]);

        $frais->update($validated);

        return response()->json($frais->fresh()->load('user:id,name'));
    }

    public function fraisDestroy(OrdreMission $ordreMission, FraisDeplacement $frais): JsonResponse
    {
        abort_if($frais->ordre_mission_id !== $ordreMission->id, 404);
        $frais->delete();

        return response()->json(null, 204);
    }
}
