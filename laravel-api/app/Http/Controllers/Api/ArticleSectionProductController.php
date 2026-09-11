<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ArticleSectionProduct;
use App\Models\Catalogue\Article;
use App\Services\Catalogue\ArticleSectionProductService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ArticleSectionProductController extends Controller
{
    public function __construct(
        private readonly ArticleSectionProductService $sectionProducts,
    ) {}

    public function index(Request $request, Article $article): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        if (! $article->isJalon() && ! $article->isProduct()) {
            return response()->json([
                'technicien' => [],
                'ingenieur' => [],
                'labo' => [],
            ]);
        }

        return response()->json($this->sectionProducts->groupedForArticle($article));
    }

    public function sync(Request $request, Article $article): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $data = $request->validate([
            'section_type' => ['required', Rule::in(ArticleSectionProduct::SECTIONS)],
            'product_article_ids' => 'present|array',
            'product_article_ids.*' => 'integer|exists:ref_articles,id',
        ]);

        $grouped = $this->sectionProducts->syncSection(
            $article,
            $data['section_type'],
            $data['product_article_ids'] ?? [],
        );

        return response()->json($grouped);
    }
}
