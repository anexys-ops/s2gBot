<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Borehole;
use App\Models\LithologyLayer;
use App\Models\Site;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class LithologyLayerController extends Controller
{
    public function index(Request $request, Borehole $borehole): JsonResponse
    {
        $site = $this->siteForBorehole($borehole);
        if ($response = $this->ensureSiteReadable($request, $site)) {
            return $response;
        }

        $layers = LithologyLayer::query()
            ->where('borehole_id', $borehole->id)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return response()->json($layers);
    }

    public function store(Request $request, Borehole $borehole): JsonResponse
    {
        $site = $this->siteForBorehole($borehole);
        if ($response = $this->ensureSiteReadable($request, $site)) {
            return $response;
        }
        if ($response = $this->ensureLab($request)) {
            return $response;
        }

        $validated = $request->validate([
            'depth_from_m' => 'required|numeric|min:0',
            'depth_to_m' => 'required|numeric|min:0|gte:depth_from_m',
            'description' => 'required|string',
            'rqd' => 'nullable|numeric|min:0|max:100',
            'sort_order' => 'nullable|integer|min:0',
        ]);

        $validated['borehole_id'] = $borehole->id;
        if (! isset($validated['sort_order'])) {
            $validated['sort_order'] = 0;
        }

        $layer = LithologyLayer::create($validated);

        return response()->json($layer->load('borehole.mission.site'), 201);
    }

    public function show(Request $request, LithologyLayer $lithologyLayer): JsonResponse
    {
        $lithologyLayer->load('borehole.mission.site');
        if ($response = $this->ensureSiteReadable($request, $lithologyLayer->borehole->mission->site)) {
            return $response;
        }

        return response()->json($lithologyLayer);
    }

    public function update(Request $request, LithologyLayer $lithologyLayer): JsonResponse
    {
        if ($response = $this->ensureLab($request)) {
            return $response;
        }

        $validated = $request->validate([
            'depth_from_m' => 'sometimes|numeric|min:0',
            'depth_to_m' => 'sometimes|numeric|min:0',
            'description' => 'sometimes|string',
            'rqd' => 'nullable|numeric|min:0|max:100',
            'sort_order' => 'nullable|integer|min:0',
        ]);

        if (isset($validated['depth_from_m']) || isset($validated['depth_to_m'])) {
            $from = $validated['depth_from_m'] ?? $lithologyLayer->depth_from_m;
            $to = $validated['depth_to_m'] ?? $lithologyLayer->depth_to_m;
            if ((float) $to < (float) $from) {
                throw ValidationException::withMessages([
                    'depth_to_m' => ['La profondeur de fin doit être supérieure ou égale à la profondeur de début.'],
                ]);
            }
        }

        $lithologyLayer->update($validated);

        return response()->json($lithologyLayer->load('borehole.mission.site'));
    }

    public function destroy(Request $request, LithologyLayer $lithologyLayer): JsonResponse
    {
        if ($response = $this->ensureLab($request)) {
            return $response;
        }

        $lithologyLayer->delete();

        return response()->json(null, 204);
    }

    private function siteForBorehole(Borehole $borehole): Site
    {
        $borehole->loadMissing('mission.site');

        return $borehole->mission->site;
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
        if (($user->isClient() || $user->isSiteContact()) && $user->client_id === $site->client_id) {
            return null;
        }

        return $this->unauthorized();
    }

    private function ensureLab(Request $request): ?JsonResponse
    {
        return $request->user()->isLab() ? null : $this->unauthorized();
    }
}
