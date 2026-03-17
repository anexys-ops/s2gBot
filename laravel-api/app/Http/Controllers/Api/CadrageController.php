<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LabCadrage;
use App\Services\BtpCalculationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CadrageController extends Controller
{
    public function show(): JsonResponse
    {
        $cadrage = LabCadrage::first();
        $defaults = [
            'types_essais_demarrage' => [],
            'normes_referentiels' => [],
            'perimetre' => null,
            'tracabilite_iso17025' => [
                'audit_trail' => false,
                'signatures' => false,
                'etalonnages' => false,
            ],
            'checklist_done' => [],
        ];
        $payload = $cadrage ? $cadrage->toArray() : $defaults;
        $payload['options'] = self::getOptions();
        return response()->json($payload);
    }

    public function update(Request $request): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'types_essais_demarrage' => 'nullable|array',
            'types_essais_demarrage.*' => 'string|in:beton,sols,granulats,bitume,acier,autres',
            'normes_referentiels' => 'nullable|array',
            'normes_referentiels.*' => 'string|in:NF,EN,ASTM,methodes_internes',
            'perimetre' => 'nullable|string|in:1_labo,multi_sites,mobile_chantier',
            'tracabilite_iso17025' => 'nullable|array',
            'tracabilite_iso17025.audit_trail' => 'boolean',
            'tracabilite_iso17025.signatures' => 'boolean',
            'tracabilite_iso17025.etalonnages' => 'boolean',
            'checklist_done' => 'nullable|array',
        ]);

        $cadrage = LabCadrage::firstOrNew([]);
        $cadrage->fill($validated);
        $cadrage->updated_by = $request->user()->id;
        $cadrage->save();

        return response()->json($cadrage->fresh());
    }

    public static function getOptions(): array
    {
        return [
            'types_essais_demarrage' => [
                ['value' => 'beton', 'label' => 'Béton'],
                ['value' => 'sols', 'label' => 'Sols'],
                ['value' => 'granulats', 'label' => 'Granulats'],
                ['value' => 'bitume', 'label' => 'Bitume'],
                ['value' => 'acier', 'label' => 'Acier'],
                ['value' => 'autres', 'label' => 'Autres'],
            ],
            'normes_referentiels' => [
                ['value' => 'NF', 'label' => 'Normes françaises (NF)'],
                ['value' => 'EN', 'label' => 'Normes européennes (EN)'],
                ['value' => 'ASTM', 'label' => 'ASTM'],
                ['value' => 'methodes_internes', 'label' => 'Méthodes internes'],
            ],
            'perimetre' => [
                ['value' => '1_labo', 'label' => '1 laboratoire fixe'],
                ['value' => 'multi_sites', 'label' => 'Multi-sites'],
                ['value' => 'mobile_chantier', 'label' => 'Mobile (chantier)'],
            ],
        ];
    }
}
