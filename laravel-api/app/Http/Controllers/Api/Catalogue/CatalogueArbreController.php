<?php

namespace App\Http\Controllers\Api\Catalogue;

use App\Http\Controllers\Controller;
use App\Models\Catalogue\FamilleArticle;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CatalogueArbreController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $q = FamilleArticle::query();
        if (! $request->boolean('with_inactif')) {
            $q->actif();
        }

        $familles = $q->ordonne()
            ->with([
                'articles' => function ($a) use ($request) {
                    if (! $request->boolean('with_inactif')) {
                        $a->actif();
                    }
                    $a->ordonne()
                        ->with([
                            'famillePackages' => function ($fp) use ($request) {
                                if (! $request->boolean('with_inactif')) {
                                    $fp->actif();
                                }
                                $fp->ordonne()
                                    ->with(['packages' => function ($p) use ($request) {
                                        if (! $request->boolean('with_inactif')) {
                                            $p->actif();
                                        }
                                        $p->ordonne();
                                    }]);
                            },
                        ]);
                },
            ])
            ->get();

        return response()->json($familles);
    }
}
