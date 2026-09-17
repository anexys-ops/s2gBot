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

    public function store(Request $request, Article $article): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $data = $request->validate([
            'section_type' => ['required', Rule::in(ArticleSectionProduct::SECTIONS)],
            'product_article_id' => 'required|integer|exists:ref_articles,id',
            'quantite' => 'sometimes|integer|min:1|max:9999',
        ]);

        $grouped = $this->sectionProducts->addProduct(
            $article,
            $data['section_type'],
            (int) $data['product_article_id'],
            (int) ($data['quantite'] ?? 1),
        );

        return response()->json($grouped);
    }

    public function update(Request $request, Article $article, ArticleSectionProduct $sectionProduct): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $data = $request->validate([
            'quantite' => 'required|integer|min:1|max:9999',
        ]);

        $grouped = $this->sectionProducts->updateQuantite(
            $article,
            $sectionProduct,
            (int) $data['quantite'],
        );

        return response()->json($grouped);
    }

    public function destroy(Request $request, Article $article, ArticleSectionProduct $sectionProduct): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $grouped = $this->sectionProducts->removeProduct($article, $sectionProduct);

        return response()->json($grouped);
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
