<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
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
        $mission->load('site');
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

        return response()->json($mission->load('site'));
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
}
