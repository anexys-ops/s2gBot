<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Sample;
use App\Services\LabReceptionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LabReceptionController extends Controller
{
    public function __construct(
        private readonly LabReceptionService $receptionService,
    ) {}

    /**
     * Produits attendus en réception — lignes BC confirmées avec essai labo et technicien terrain.
     */
    public function attendus(Request $request): JsonResponse
    {
        $search = $request->query('search');
        $items = $this->receptionService->listAttendus(is_string($search) ? $search : null);

        $complete = $items->where('reception_complete', true)->count();
        $pending = $items->where('reception_complete', false)->count();
        $essaisAttendus = $items->sum('quantite_attendue');
        $essaisRecus = $items->sum('quantite_recue');

        return response()->json([
            'data' => $items,
            'stats' => [
                'produits' => $items->count(),
                'produits_en_attente' => $pending,
                'produits_complets' => $complete,
                'essais_attendus' => $essaisAttendus,
                'essais_recus' => $essaisRecus,
                'essais_en_transit' => $items->sum('quantite_en_transit'),
            ],
        ]);
    }

    public function stats(): JsonResponse
    {
        $items = $this->receptionService->listAttendus();
        $by = fn (string $status): int => Sample::query()->where('status', $status)->count();

        return response()->json([
            'produits_attendus' => $items->count(),
            'produits_en_attente' => $items->where('reception_complete', false)->count(),
            'essais_attendus' => $items->sum('quantite_attendue'),
            'essais_recus' => $items->sum('quantite_recue'),
            'en_transit' => $by(Sample::STATUS_EN_TRANSIT),
            'receptionne' => $by(Sample::STATUS_RECEPTIONNE),
            'en_essai' => $by(Sample::STATUS_EN_ESSAI),
            'receptionnes_today' => Sample::query()
                ->where('status', Sample::STATUS_RECEPTIONNE)
                ->whereDate('received_at', today())
                ->count(),
        ]);
    }
}
