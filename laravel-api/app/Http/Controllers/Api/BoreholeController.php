<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Borehole;
use App\Models\Mission;
use App\Models\Site;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class BoreholeController extends Controller
{
    public function index(Request $request, Mission $mission): JsonResponse
    {
        $mission->load('site');
        if ($response = $this->ensureSiteReadable($request, $mission->site)) {
            return $response;
        }

        $boreholes = Borehole::query()
            ->where('mission_id', $mission->id)
            ->orderBy('code')
            ->get();

        return response()->json($boreholes);
    }

    public function store(Request $request, Mission $mission): JsonResponse
    {
        $mission->load('site');
        if ($response = $this->ensureSiteReadable($request, $mission->site)) {
            return $response;
        }
        if ($response = $this->ensureLab($request)) {
            return $response;
        }

        $validated = $request->validate([
            'code' => [
                'required',
                'string',
                'max:255',
                Rule::unique('boreholes')->where(fn ($q) => $q->where('mission_id', $mission->id)),
            ],
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
            'ground_level_m' => 'nullable|numeric',
            'notes' => 'nullable|string',
        ]);

        $validated['mission_id'] = $mission->id;
        $borehole = Borehole::create($validated);

        return response()->json($borehole->load('mission.site'), 201);
    }

    public function show(Request $request, Borehole $borehole): JsonResponse
    {
        $borehole->load('mission.site');
        if ($response = $this->ensureSiteReadable($request, $borehole->mission->site)) {
            return $response;
        }

        return response()->json($borehole);
    }

    public function update(Request $request, Borehole $borehole): JsonResponse
    {
        if ($response = $this->ensureLab($request)) {
            return $response;
        }

        $validated = $request->validate([
            'code' => [
                'sometimes',
                'string',
                'max:255',
                Rule::unique('boreholes')
                    ->where(fn ($q) => $q->where('mission_id', $borehole->mission_id))
                    ->ignore($borehole->id),
            ],
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
            'ground_level_m' => 'nullable|numeric',
            'notes' => 'nullable|string',
        ]);

        $borehole->update($validated);

        return response()->json($borehole->load('mission.site'));
    }

    public function destroy(Request $request, Borehole $borehole): JsonResponse
    {
        if ($response = $this->ensureLab($request)) {
            return $response;
        }

        $borehole->delete();

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
