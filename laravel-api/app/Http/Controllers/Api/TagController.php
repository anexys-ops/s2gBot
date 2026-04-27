<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Tag;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TagController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(Tag::orderBy('name')->get(['id', 'name', 'color']));
    }

    public function sync(Request $request): JsonResponse
    {
        $data = $request->validate([
            'entity_type' => 'required|string|in:client,quote,bon_commande,bon_livraison,dossier,site,equipment',
            'entity_id'   => 'required|integer|min:1',
            'names'       => 'required|array',
            'names.*'     => 'string|max:100',
        ]);

        $modelMap = [
            'client'       => \App\Models\Client::class,
            'quote'        => \App\Models\Quote::class,
            'bon_commande' => \App\Models\BonCommande::class,
            'bon_livraison'=> \App\Models\BonLivraison::class,
            'dossier'      => \App\Models\Dossier::class,
            'site'         => \App\Models\Site::class,
            'equipment'    => \App\Models\Equipment::class,
        ];

        $modelClass = $modelMap[$data['entity_type']] ?? null;
        if (! $modelClass) {
            return response()->json(['message' => 'Type non supporté'], 422);
        }

        $entity = $modelClass::findOrFail($data['entity_id']);

        // Upsert tags and sync via taggables pivot
        $ids = collect($data['names'])
            ->filter()
            ->map(fn (string $name) => Tag::firstOrCreate(
                ['name' => trim($name)],
                ['color' => '#6366f1']
            )->id)
            ->unique()
            ->values();

        // Use direct DB sync via taggables table
        $taggableType = $entity::class;
        $entityId     = $entity->id;

        \Illuminate\Support\Facades\DB::table('taggables')
            ->where('taggable_type', $taggableType)
            ->where('taggable_id', $entityId)
            ->delete();

        foreach ($ids as $tagId) {
            \Illuminate\Support\Facades\DB::table('taggables')->insertOrIgnore([
                'tag_id'        => $tagId,
                'taggable_type' => $taggableType,
                'taggable_id'   => $entityId,
            ]);
        }

        return response()->json(['synced' => $ids->count()]);
    }

    public function forEntity(Request $request): JsonResponse
    {
        $request->validate([
            'entity_type' => 'required|string',
            'entity_id'   => 'required|integer',
        ]);

        $tags = \Illuminate\Support\Facades\DB::table('taggables')
            ->join('tags', 'tags.id', '=', 'taggables.tag_id')
            ->where('taggables.taggable_type', 'like', '%' . $request->string('entity_type'))
            ->where('taggables.taggable_id', $request->integer('entity_id'))
            ->select('tags.id', 'tags.name', 'tags.color')
            ->get();

        return response()->json($tags);
    }
}
