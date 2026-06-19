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

        return response()->json($q->ordonne()->get());
    }

    public function articles(Request $request, FamilleArticle $famille): JsonResponse
    {
        $q = Article::query()->where('ref_famille_article_id', $famille->id);
        if (! $request->boolean('with_inactif')) {
            $q->actif();
        }
        if (! $request->boolean('with_legacy')) {
            $q->catalogueS2g();
        }

        $articles = $q->ordonne()
            ->with(['famillePackages' => fn ($x) => $x->ordonne()->with(['packages' => fn ($p) => $p->ordonne()])])
            ->get();

        return response()->json($articles);
    }
}
