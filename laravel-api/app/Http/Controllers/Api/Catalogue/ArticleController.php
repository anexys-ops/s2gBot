<?php

namespace App\Http\Controllers\Api\Catalogue;

use App\Http\Controllers\Controller;
use App\Http\Resources\Catalogue\ArticleResource;
use App\Models\Catalogue\Article;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ArticleController extends Controller
{
    use AuthorizesRequests;

    public function index(Request $request): JsonResponse
    {
        $q = Article::query()->with([
            'famille',
            'articleLie:id,code,libelle',
            'qualificationTags' => fn ($t) => $t->orderBy('groupe')->orderBy('code'),
        ]);
        if (! $request->boolean('with_inactif')) {
            $q->actif();
        }
        if ($request->filled('ref_famille_article_id')) {
            $q->where('ref_famille_article_id', (int) $request->query('ref_famille_article_id'));
        }
        if ($kind = trim((string) $request->query('kind', ''))) {
            $q->where('kind', $kind);
        }
        if ($tagCode = trim((string) $request->query('qualification_tag_code', ''))) {
            $q->where('kind', Article::KIND_JALON)
                ->whereHas('qualificationTags', fn ($b) => $b->where('code', $tagCode));
        }
        if (! $request->boolean('with_legacy')) {
            $q->catalogueS2g();
        }
        if ($search = trim((string) $request->query('q', ''))) {
            $q->where(function ($b) use ($search) {
                $b->where('code', 'like', '%'.$search.'%')
                    ->orWhere('libelle', 'like', '%'.$search.'%')
                    ->orWhere('code_interne', 'like', '%'.$search.'%')
                    ->orWhere('sku', 'like', '%'.$search.'%');
            });
        }

        return response()->json(
            $q->ordonne()->get()->map(fn (Article $article) => [
                'id' => $article->id,
                'ref_famille_article_id' => $article->ref_famille_article_id,
                'ref_article_lie_id' => $article->ref_article_lie_id,
                'code' => $article->code,
                'code_interne' => $article->code_interne,
                'sku' => $article->sku,
                'libelle' => $article->libelle,
                'description' => $article->description,
                'description_commerciale' => $article->description_commerciale,
                'description_technique' => $article->description_technique,
                'tags' => $article->isJalon() || $article->isProduct() ? null : $article->tags,
                'unite' => $article->unite,
                'hfsql_unite' => $article->hfsql_unite,
                'prix_unitaire_ht' => $article->prix_unitaire_ht,
                'prix_revient_ht' => $article->prix_revient_ht,
                'prix_unitaire_ht_formate' => $article->prix_unitaire_ht_formate,
                'tva_rate' => $article->tva_rate,
                'duree_estimee' => $article->duree_estimee,
                'normes' => $article->normes,
                'actif' => $article->actif,
                'kind' => $article->kind ?? Article::KIND_LEGACY,
                'famille_label' => $article->famille_label,
                'famille' => $article->famille,
                'article_lie' => $article->articleLie ? [
                    'id' => $article->articleLie->id,
                    'code' => $article->articleLie->code,
                    'libelle' => $article->articleLie->libelle,
                ] : null,
                'qualification_tags' => $article->isJalon()
                    ? $article->qualificationTags->map(fn ($tag) => [
                        'id' => $tag->id,
                        'code' => $tag->code,
                        'label' => $tag->label,
                        'display_label' => $tag->displayLabel(),
                        'groupe' => $tag->groupe,
                    ])->values()
                    : [],
            ])
        );
    }

    public function show(Article $article): JsonResponse
    {
        $loads = [
            'famille',
            'articleLie:id,code,libelle',
            'parametresEssai' => fn ($p) => $p->ordonne(),
            'resultats' => fn ($r) => $r->orderBy('code'),
            'famillePackages' => fn ($f) => $f->ordonne()->with(['packages' => fn ($x) => $x->ordonne()]),
        ];

        if ($article->isJalon()) {
            $loads['qualificationTags'] = fn ($t) => $t->orderBy('groupe')->orderBy('code');
            $loads['jalonProductLinks'] = fn ($jp) => $jp->with([
                'product:id,code,libelle,unite,prix_unitaire_ht,tva_rate,kind,actif',
            ]);
        }

        $article->load($loads);

        return (new ArticleResource($article))->response();
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', Article::class);

        $data = $request->validate($this->rules());
        $article = Article::create($data);

        return (new ArticleResource($article->load('famille')))->response()->setStatusCode(201);
    }

    public function update(Request $request, Article $article): JsonResponse
    {
        $this->authorize('update', $article);

        $data = $request->validate($this->rules($article->id, true));
        $article->update($data);
        $fresh = $article->fresh();
        $fresh->load([
            'famille',
            'parametresEssai' => fn ($p) => $p->ordonne(),
            'resultats' => fn ($r) => $r->orderBy('code'),
            'famillePackages' => fn ($f) => $f->ordonne()->with(['packages' => fn ($x) => $x->ordonne()]),
        ]);

        return (new ArticleResource($fresh))->response();
    }

    public function destroy(Request $request, Article $article): JsonResponse
    {
        $this->authorize('delete', $article);
        $article->delete();

        return response()->json(null, 204);
    }

    /**
     * @return array<string, mixed>
     */
    private function rules(?int $ignoreId = null, bool $partial = false): array
    {
        $codeUnique = Rule::unique('ref_articles', 'code');
        if ($ignoreId !== null) {
            $codeUnique = $codeUnique->ignore($ignoreId);
        }

        $code = $partial
            ? ['sometimes', 'string', 'max:128', $codeUnique]
            : ['required', 'string', 'max:128', $codeUnique];

        $famille = $partial
            ? 'sometimes|integer|exists:ref_famille_articles,id'
            : 'required|integer|exists:ref_famille_articles,id';

        $libelle = $partial ? 'sometimes|string|max:255' : 'required|string|max:255';

        $lie = ['nullable', 'integer', 'exists:ref_articles,id'];
        if ($ignoreId !== null) {
            $lie = [
                'nullable',
                'integer',
                Rule::exists('ref_articles', 'id')->whereNot('id', $ignoreId),
            ];
        }

        return [
            'ref_famille_article_id' => $famille,
            'ref_article_lie_id' => $lie,
            'code' => $code,
            'code_interne' => 'nullable|string|max:64',
            'sku' => 'nullable|string|max:64',
            'libelle' => $libelle,
            'description' => 'nullable|string',
            'description_commerciale' => 'nullable|string',
            'description_technique' => 'nullable|string',
            'tags' => 'nullable|array',
            'tags.*' => 'string|max:64',
            'unite' => 'nullable|string|max:32',
            'hfsql_unite' => 'nullable|string|max:64',
            'prix_unitaire_ht' => 'nullable|numeric|min:0',
            'prix_revient_ht' => 'nullable|numeric|min:0',
            'tva_rate' => 'nullable|numeric|min:0|max:100',
            'duree_estimee' => 'nullable|integer|min:0',
            'normes' => 'nullable|string',
            'actif' => 'boolean',
        ];
    }
}
