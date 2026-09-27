<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class GeocodeController extends Controller
{
    /**
     * Recherche d'adresses via Nominatim (OpenStreetMap), biaisée Maroc.
     * Résultats mis en cache (mêmes conditions de requête → même réponse pendant 24h)
     * pour rester dans la limite d'usage de Nominatim (1 req/s, usage raisonnable).
     */
    public function search(Request $request): JsonResponse
    {
        $query = trim((string) $request->query('q', ''));
        if (mb_strlen($query) < 3) {
            return response()->json([]);
        }

        $cacheKey = 'geocode:search:'.mb_strtolower($query);

        $results = Cache::remember($cacheKey, now()->addDay(), function () use ($query) {
            $response = Http::withHeaders([
                'User-Agent' => 'S2gBot-LIMS/1.0 (+https://s2g.apps-dev.fr)',
            ])->timeout(5)->get('https://nominatim.openstreetmap.org/search', [
                'q' => $query,
                'format' => 'jsonv2',
                'addressdetails' => 1,
                'limit' => 5,
                'countrycodes' => 'ma',
            ]);

            if (! $response->successful()) {
                return [];
            }

            return collect($response->json())
                ->map(function (array $item) {
                    $addr = $item['address'] ?? [];

                    return [
                        'label' => $item['display_name'] ?? '',
                        'lat' => isset($item['lat']) ? (float) $item['lat'] : null,
                        'lon' => isset($item['lon']) ? (float) $item['lon'] : null,
                        'road' => $addr['road'] ?? null,
                        'house_number' => $addr['house_number'] ?? null,
                        'postcode' => $addr['postcode'] ?? null,
                        'city' => $addr['city'] ?? $addr['town'] ?? $addr['village'] ?? $addr['municipality'] ?? null,
                    ];
                })
                ->values()
                ->all();
        });

        return response()->json($results);
    }
}
