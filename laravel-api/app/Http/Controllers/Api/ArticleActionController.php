<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ArticleAction;
use App\Models\ArticleEquipmentRequirement;
use App\Models\Catalogue\Article;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ArticleActionController extends Controller
{
    // ── Actions ──────────────────────────────────────────────────────────────

    public function index(Article $article): JsonResponse
    {
        return response()->json(
            $article->actions()->get()
        );
    }

    public function store(Request $request, Article $article): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'type'         => 'required|in:technicien,ingenieur,labo',
            'libelle'      => 'required|string|max:255',
            'description'  => 'nullable|string',
            'duree_heures' => 'nullable|integer|min:0|max:9999',
            'ordre'        => 'nullable|integer|min:0',
        ]);

        $action = $article->actions()->create($validated);

        return response()->json($action, 201);
    }

    public function update(Request $request, Article $article, ArticleAction $action): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        abort_if($action->ref_article_id !== $article->id, 404);

        $validated = $request->validate([
            'type'         => 'sometimes|in:technicien,ingenieur,labo',
            'libelle'      => 'sometimes|string|max:255',
            'description'  => 'nullable|string',
            'duree_heures' => 'nullable|integer|min:0|max:9999',
            'ordre'        => 'nullable|integer|min:0',
        ]);

        $action->update($validated);

        return response()->json($action->fresh());
    }

    public function destroy(Request $request, Article $article, ArticleAction $action): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        abort_if($action->ref_article_id !== $article->id, 404);
        $action->delete();

        return response()->json(null, 204);
    }

    // ── Equipment requirements ────────────────────────────────────────────────

    public function equipmentIndex(Article $article): JsonResponse
    {
        return response()->json(
            $article->equipmentRequirements()->with('equipment:id,name,code,type')->get()
        );
    }

    public function equipmentStore(Request $request, Article $article): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'equipment_id' => 'required|exists:equipments,id',
            'quantite'     => 'nullable|integer|min:1',
            'notes'        => 'nullable|string',
        ]);

        $req = $article->equipmentRequirements()->updateOrCreate(
            ['equipment_id' => $validated['equipment_id']],
            $validated
        );

        return response()->json($req->load('equipment:id,name,code,type'), 201);
    }

    public function equipmentDestroy(Request $request, Article $article, ArticleEquipmentRequirement $requirement): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        abort_if($requirement->ref_article_id !== $article->id, 404);
        $requirement->delete();

        return response()->json(null, 204);
    }
}
