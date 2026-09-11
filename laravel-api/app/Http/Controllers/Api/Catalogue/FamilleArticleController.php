<?php

namespace App\Http\Controllers\Api\Catalogue;

use App\Http\Controllers\Controller;
use App\Models\Catalogue\Article;
use App\Models\Catalogue\FamilleArticle;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FamilleArticleController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = FamilleArticle::query();
        if (! $request->boolean('with_inactif')) {
            $q->actif();
        }
        if (Article::hasS2gCatalogue() && ! $request->boolean('with_legacy')) {
            $q->whereHas('articles', function ($a) use ($request): void {
                if (! $request->boolean('with_inactif')) {
                    $a->actif();
                }
                $a->catalogueS2g();
            });
        }

        return response()->json($q->ordonne()->get());
    }

    public function articles(Request $request, FamilleArticle $famille): JsonResponse
    {
        $q = Article::query()->where('ref_famille_article_id', $famille->id);
        if (! $request->boolean('with_inactif')) {
            $q->actif();
        }
        if (! $request->boolean('with_legacy')) {
            $q->forCatalogueListing();
        }

        $articles = $q->ordonne()
            ->with(['famillePackages' => fn ($x) => $x->ordonne()->with(['packages' => fn ($p) => $p->ordonne()])])
            ->get();

        return response()->json($articles);
    }
}
