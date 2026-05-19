<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Catalogue\Article;
use App\Models\Catalogue\ArticleComposition;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ArticleCompositionController extends Controller
{
    public function index(int $articleId): JsonResponse
    {
        $article = Article::findOrFail($articleId);

        return response()->json(
            $article->compositions()->with('child:id,code,libelle,unite,prix_unitaire_ht')->get()
        );
    }

    public function store(Request $request, int $articleId): JsonResponse
    {
        $article = Article::findOrFail($articleId);

        $validated = $request->validate([
            'child_article_id' => 'required|exists:ref_articles,id|different:parent_article_id',
            'qty_per_unit'     => 'required|integer|min:1',
            'is_optional'      => 'sometimes|boolean',
            'ordre'            => 'sometimes|integer|min:0',
        ]);

        // Prevent duplicate child in same parent
        $exists = ArticleComposition::where('parent_article_id', $article->id)
            ->where('child_article_id', $validated['child_article_id'])
            ->exists();

        if ($exists) {
            return response()->json(['message' => 'Cet article est déjà dans la composition.'], 422);
        }

        if (! isset($validated['ordre'])) {
            $validated['ordre'] = ArticleComposition::where('parent_article_id', $article->id)->max('ordre') + 1;
        }

        $composition = ArticleComposition::create(array_merge(
            $validated,
            ['parent_article_id' => $article->id]
        ));

        return response()->json($composition->load('child:id,code,libelle,unite,prix_unitaire_ht'), 201);
    }

    public function update(Request $request, int $articleId, int $compositionId): JsonResponse
    {
        $article     = Article::findOrFail($articleId);
        $composition = ArticleComposition::where('parent_article_id', $article->id)->findOrFail($compositionId);

        $validated = $request->validate([
            'qty_per_unit' => 'sometimes|integer|min:1',
            'is_optional'  => 'sometimes|boolean',
            'ordre'        => 'sometimes|integer|min:0',
        ]);

        $composition->update($validated);

        return response()->json($composition->load('child:id,code,libelle,unite,prix_unitaire_ht'));
    }

    public function destroy(int $articleId, int $compositionId): JsonResponse
    {
        $article     = Article::findOrFail($articleId);
        $composition = ArticleComposition::where('parent_article_id', $article->id)->findOrFail($compositionId);

        $composition->delete();

        return response()->json(null, 204);
    }

    public function reorder(Request $request, int $articleId): JsonResponse
    {
        $article = Article::findOrFail($articleId);

        $validated = $request->validate([
            'ids'   => 'required|array|min:1',
            'ids.*' => 'required|integer|exists:article_compositions,id',
        ]);

        foreach ($validated['ids'] as $ordre => $compositionId) {
            ArticleComposition::where('parent_article_id', $article->id)
                ->where('id', $compositionId)
                ->update(['ordre' => $ordre]);
        }

        return response()->json(
            $article->compositions()->with('child:id,code,libelle,unite,prix_unitaire_ht')->get()
        );
    }
}
