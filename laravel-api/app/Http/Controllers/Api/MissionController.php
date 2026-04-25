<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BonCommande;
use App\Models\Dossier;
use App\Models\Mission;
use App\Models\Site;
use App\Support\AgencyAccess;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MissionController extends Controller
{
    public function __construct(
        private ActivityLogger $activityLogger
    ) {}

    public function all(Request $request): JsonResponse
    {
        $q = Mission::query()
            ->with(['site.client', 'dossier', 'bonCommande'])
            ->orderByDesc('id');

        if ($request->filled('dossier_id')) {
            $q->where('dossier_id', (int) $request->query('dossier_id'));
        }
        if ($request->filled('bon_commande_id')) {
            $q->where('bon_commande_id', (int) $request->query('bon_commande_id'));
        }

        $user = $request->user();
        if (! $user->isLab()) {
            if (! $user->client_id) {
                return $this->unauthorized();
            }
            $q->whereHas('site', fn ($siteQuery) => $siteQuery->where('client_id', $user->client_id));
        }

        return response()->json($q->get());
    }

    public function storeGlobal(Request $request): JsonResponse
    {
        if ($response = $this->ensureLab($request)) {
            return $response;
        }

        $validated = $request->validate([
            'source_type' => 'required|in:dossier,bon_commande',
            'source_id' => 'required|integer|min:1',
            'reference' => 'nullable|string|max:255|unique:missions,reference',
            'title' => 'nullable|string|max:255',
            'mission_status' => 'nullable|in:g1,g2,g3,g4,g5',
            'maitre_ouvrage_name' => 'nullable|string|max:255',
            'maitre_ouvrage_email' => 'nullable|string|max:255',
            'maitre_ouvrage_phone' => 'nullable|string|max:255',
            'notes' => 'nullable|string',
            'meta' => 'nullable|array',
        ]);

        $source = $this->resolveSource($validated['source_type'], (int) $validated['source_id']);
        if (! $source) {
            return response()->json(['message' => 'Source introuvable ou sans chantier.'], 422);
        }

        $mission = Mission::create([
            'site_id' => $source['site_id'],
            'dossier_id' => $source['dossier_id'],
            'bon_commande_id' => $source['bon_commande_id'],
            'reference' => ($validated['reference'] ?? null) ?: $this->nextMissionReference(),
            'title' => $validated['title'] ?? $source['title'],
            'mission_status' => $validated['mission_status'] ?? 'g1',
            'maitre_ouvrage_name' => $validated['maitre_ouvrage_name'] ?? null,
            'maitre_ouvrage_email' => $validated['maitre_ouvrage_email'] ?? null,
            'maitre_ouvrage_phone' => $validated['maitre_ouvrage_phone'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'meta' => $validated['meta'] ?? null,
        ]);

        $this->activityLogger->log($request->user(), 'mission.created', $mission, [
            'reference' => $mission->reference,
            'site_id' => $mission->site_id,
        ]);

        return response()->json($mission->load(['site.client', 'dossier', 'bonCommande']), 201);
    }

    public function index(Request $request, Site $site): JsonResponse
    {
        if ($response = $this->ensureSiteReadable($request, $site)) {
            return $response;
        }

        $missions = Mission::query()
            ->where('site_id', $site->id)
            ->orderBy('reference')
            ->get();

        return response()->json($missions);
    }

    public function store(Request $request, Site $site): JsonResponse
    {
        if ($response = $this->ensureSiteReadable($request, $site)) {
            return $response;
        }
        if ($response = $this->ensureLab($request)) {
            return $response;
        }

        $validated = $request->validate([
            'reference' => 'required|string|max:255|unique:missions,reference',
            'dossier_id' => 'nullable|integer|exists:dossiers,id',
            'bon_commande_id' => 'nullable|integer|exists:bons_commande,id',
            'title' => 'nullable|string|max:255',
            'mission_status' => 'nullable|in:g1,g2,g3,g4,g5',
            'maitre_ouvrage_name' => 'nullable|string|max:255',
            'maitre_ouvrage_email' => 'nullable|string|max:255',
            'maitre_ouvrage_phone' => 'nullable|string|max:255',
            'notes' => 'nullable|string',
            'meta' => 'nullable|array',
        ]);

        $validated['site_id'] = $site->id;
        if (! isset($validated['mission_status'])) {
            $validated['mission_status'] = 'g1';
        }

        $mission = Mission::create($validated);
        $this->activityLogger->log($request->user(), 'mission.created', $mission, [
            'reference' => $mission->reference,
            'site_id' => $site->id,
        ]);

        return response()->json($mission->load('site'), 201);
    }

    public function show(Request $request, Mission $mission): JsonResponse
    {
        $mission->load(['site.client', 'dossier', 'bonCommande']);
        if ($response = $this->ensureSiteReadable($request, $mission->site)) {
            return $response;
        }

        return response()->json($mission);
    }

    public function update(Request $request, Mission $mission): JsonResponse
    {
        if ($response = $this->ensureLab($request)) {
            return $response;
        }

        $validated = $request->validate([
            'reference' => 'sometimes|string|max:255|unique:missions,reference,'.$mission->id,
            'dossier_id' => 'nullable|integer|exists:dossiers,id',
            'bon_commande_id' => 'nullable|integer|exists:bons_commande,id',
            'title' => 'nullable|string|max:255',
            'mission_status' => 'sometimes|in:g1,g2,g3,g4,g5',
            'maitre_ouvrage_name' => 'nullable|string|max:255',
            'maitre_ouvrage_email' => 'nullable|string|max:255',
            'maitre_ouvrage_phone' => 'nullable|string|max:255',
            'notes' => 'nullable|string',
            'meta' => 'nullable|array',
        ]);

        $mission->update($validated);
        $this->activityLogger->log($request->user(), 'mission.updated', $mission->fresh(), [
            'reference' => $mission->reference,
        ]);

        return response()->json($mission->load(['site.client', 'dossier', 'bonCommande']));
    }

    public function destroy(Request $request, Mission $mission): JsonResponse
    {
        if ($response = $this->ensureLab($request)) {
            return $response;
        }

        $this->activityLogger->log($request->user(), 'mission.deleted', null, [
            'mission_id' => $mission->id,
            'reference' => $mission->reference,
        ]);
        $mission->delete();

        return response()->json(null, 204);
    }

    private function unauthorized(): JsonResponse
    {
        return response()->json(['message' => 'Non autorisé'], 403);
    }

    private function ensureSiteReadable(Request $request, Site $site): ?JsonResponse
    {
        $user = $request->user();
        if ($user->isLab()) {
            return null;
        }
        if (($user->isClient() || $user->isSiteContact()) && AgencyAccess::userMayAccessSite($user, $site)) {
            return null;
        }

        return $this->unauthorized();
    }

    private function ensureLab(Request $request): ?JsonResponse
    {
        return $request->user()->isLab() ? null : $this->unauthorized();
    }

    /**
     * @return array{site_id:int,dossier_id:int|null,bon_commande_id:int|null,title:string|null}|null
     */
    private function resolveSource(string $type, int $id): ?array
    {
        if ($type === 'bon_commande') {
            $bc = BonCommande::query()->with('dossier')->find($id);
            if (! $bc || ! $bc->dossier?->site_id) {
                return null;
            }

            return [
                'site_id' => (int) $bc->dossier->site_id,
                'dossier_id' => (int) $bc->dossier_id,
                'bon_commande_id' => (int) $bc->id,
                'title' => 'Ordre de mission '.$bc->numero,
            ];
        }

        $dossier = Dossier::query()->find($id);
        if (! $dossier?->site_id) {
            return null;
        }

        return [
            'site_id' => (int) $dossier->site_id,
            'dossier_id' => (int) $dossier->id,
            'bon_commande_id' => null,
            'title' => $dossier->titre,
        ];
    }

    private function nextMissionReference(): string
    {
        $prefix = 'OM-'.now()->format('Ymd').'-';
        $next = Mission::query()->where('reference', 'like', $prefix.'%')->count() + 1;

        do {
            $reference = $prefix.str_pad((string) $next, 3, '0', STR_PAD_LEFT);
            $next++;
        } while (Mission::query()->where('reference', $reference)->exists());

        return $reference;
    }
}
