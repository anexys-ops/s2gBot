<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TestType;
use App\Models\TestTypeParam;
use App\Models\ArticleAction;
use App\Models\Catalogue\Article;
use App\Services\DynamicTestFormService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TestTypeController extends Controller
{
    public function __construct(private readonly DynamicTestFormService $forms) {}

    public function index(): JsonResponse
    {
        $types = TestType::with(['params', 'articles:id,code,libelle'])->orderBy('name')->get();

        return response()->json($types);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'norm' => 'nullable|string|max:100',
            'unit' => 'nullable|string|max:50',
            'unit_price' => 'required|numeric|min:0',
            'thresholds' => 'nullable|array',
            'context' => 'nullable|in:terrain,ingenieur,labo',
            ...$this->formFieldRules(),
            'params' => 'nullable|array',
            'params.*.name' => 'required|string|max:255',
            'params.*.unit' => 'nullable|string|max:50',
            'params.*.expected_type' => 'nullable|in:numeric,text,date',
            'assignments' => 'sometimes|array',
            'assignments.*.article_id' => 'required|integer|distinct|exists:ref_articles,id',
            'assignments.*.article_action_id' => 'nullable|integer|exists:article_actions,id',
        ]);
        $this->assertUsableFormFields($validated['form_fields'] ?? []);

        $params = $validated['params'] ?? [];
        $assignments = $validated['assignments'] ?? [];
        unset($validated['params'], $validated['assignments']);

        $testType = DB::transaction(function () use ($validated, $params, $assignments) {
            $testType = TestType::create($validated);
            foreach ($params as $p) {
                $testType->params()->create([
                    'name' => $p['name'],
                    'unit' => $p['unit'] ?? null,
                    'expected_type' => $p['expected_type'] ?? 'numeric',
                ]);
            }
            if ($assignments !== []) {
                $testType->articles()->sync($this->assignmentMap($testType, $assignments));
            }
            return $testType;
        });

        return response()->json($testType->load(['params', 'articles:id,code,libelle']), 201);
    }

    public function show(TestType $testType): JsonResponse
    {
        return response()->json($testType->load(['params', 'articles:id,code,libelle']));
    }

    public function update(Request $request, TestType $testType): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'norm' => 'nullable|string|max:100',
            'unit' => 'nullable|string|max:50',
            'unit_price' => 'sometimes|numeric|min:0',
            'thresholds' => 'nullable|array',
            'context' => 'nullable|in:terrain,ingenieur,labo',
            ...$this->formFieldRules(),
            'params' => 'sometimes|array',
            'params.*.id' => 'nullable|integer|exists:test_type_params,id',
            'params.*.name' => 'required|string|max:255',
            'params.*.unit' => 'nullable|string|max:50',
            'params.*.expected_type' => 'nullable|in:numeric,text,date',
        ]);
        if (array_key_exists('form_fields', $validated)) {
            $this->assertUsableFormFields($validated['form_fields'] ?? []);
            if (empty($validated['form_fields']) && $testType->articles()->exists()) {
                throw ValidationException::withMessages(['form_fields' => 'Retirez les produits affectés avant de vider le formulaire.']);
            }
        }
        if (array_key_exists('context', $validated) && $validated['context'] !== $testType->context) {
            $expectedActionType = match ($validated['context']) {
                'terrain' => 'technicien', 'ingenieur' => 'ingenieur', 'labo' => 'labo', default => null,
            };
            if ($expectedActionType && $testType->articles()->whereNotNull('article_test_type.article_action_id')
                ->get()->contains(fn ($article) => ArticleAction::query()
                    ->whereKey($article->pivot->article_action_id)->where('type', '!=', $expectedActionType)->exists())) {
                throw ValidationException::withMessages(['context' => 'Retirez les affectations aux actions d’un autre domaine avant de changer le domaine.']);
            }
        }

        $paramsPayload = null;
        if (array_key_exists('params', $validated)) {
            $paramsPayload = $validated['params'];
            unset($validated['params']);
        }

        if ($validated !== []) {
            $testType->update($validated);
        }

        if ($paramsPayload !== null) {
            $incomingIds = collect($paramsPayload)->pluck('id')->filter()->values();
            foreach ($incomingIds as $paramId) {
                $ok = TestTypeParam::query()
                    ->where('id', $paramId)
                    ->where('test_type_id', $testType->id)
                    ->exists();
                if (! $ok) {
                    return response()->json(['message' => 'Paramètre invalide pour ce type d’essai.'], 422);
                }
            }

            $keepIds = $incomingIds->all();
            $testType->load('params');
            foreach ($testType->params as $param) {
                if (in_array($param->id, $keepIds, true)) {
                    continue;
                }
                if ($param->testResults()->exists()) {
                    return response()->json([
                        'message' => 'Impossible de retirer le paramètre « '.$param->name.' » : des mesures y sont liées.',
                    ], 422);
                }
                $param->delete();
            }

            foreach ($paramsPayload as $p) {
                if (! empty($p['id'])) {
                    TestTypeParam::query()
                        ->where('id', $p['id'])
                        ->where('test_type_id', $testType->id)
                        ->update([
                            'name' => $p['name'],
                            'unit' => $p['unit'] ?? null,
                            'expected_type' => $p['expected_type'] ?? 'numeric',
                        ]);
                } else {
                    $testType->params()->create([
                        'name' => $p['name'],
                        'unit' => $p['unit'] ?? null,
                        'expected_type' => $p['expected_type'] ?? 'numeric',
                    ]);
                }
            }
        }

        return response()->json($testType->fresh()->load(['params', 'articles:id,code,libelle']));
    }

    public function syncProducts(Request $request, TestType $testType): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        $data = $request->validate([
            'assignments' => 'present|array',
            'assignments.*.article_id' => 'required|integer|distinct|exists:ref_articles,id',
            'assignments.*.article_action_id' => 'nullable|integer|exists:article_actions,id',
        ]);
        $testType->articles()->sync($this->assignmentMap($testType, $data['assignments']));

        return response()->json($testType->fresh()->load(['params', 'articles:id,code,libelle']));
    }

    private function assignmentMap(TestType $testType, array $assignments): array
    {
        if ($assignments !== [] && empty($testType->form_fields)) {
            throw ValidationException::withMessages(['assignments' => 'Ajoutez au moins un champ de formulaire avant d’affecter ce type d’essai.']);
        }
        $sync = [];
        foreach ($assignments as $assignment) {
            $article = Article::query()->findOrFail($assignment['article_id']);
            if (! $article->isProduct()) {
                throw ValidationException::withMessages(['assignments' => 'Le type d’essai doit être associé à un produit.']);
            }
            $actionId = $assignment['article_action_id'] ?? null;
            $expectedActionType = match ($testType->context) {
                'terrain' => 'technicien', 'ingenieur' => 'ingenieur', 'labo' => 'labo', default => null,
            };
            if ($actionId && ! ArticleAction::query()->whereKey($actionId)->where('ref_article_id', $article->id)
                ->when($expectedActionType, fn ($query) => $query->where('type', $expectedActionType))->exists()) {
                throw ValidationException::withMessages(['assignments' => 'Cette action ne correspond pas au produit et au domaine de l’essai.']);
            }
            $sync[$article->id] = ['article_action_id' => $actionId];
        }
        return $sync;
    }

    private function formFieldRules(): array
    {
        return [
            'form_fields' => 'nullable|array',
            'form_fields.*.key' => 'required|string|alpha_dash|max:100|distinct',
            'form_fields.*.label' => 'required|string|max:255',
            'form_fields.*.type' => 'required|in:number,text,date,select,boolean,photo,checkboxes,table,formula',
            'form_fields.*.required' => 'required|boolean',
            'form_fields.*.unit' => 'nullable|string|max:50',
            'form_fields.*.options' => 'nullable|array',
            'form_fields.*.options.*' => 'string|max:100',
            'form_fields.*.list_id' => 'nullable|integer|exists:form_option_lists,id',
            'form_fields.*.formula' => 'nullable|string|max:255',
            'form_fields.*.columns' => 'nullable|array',
            'form_fields.*.columns.*.key' => 'required|string|alpha_dash|max:100|distinct',
            'form_fields.*.columns.*.label' => 'required|string|max:255',
            'form_fields.*.columns.*.type' => 'required|in:number,text,date,select,boolean,formula',
            'form_fields.*.columns.*.required' => 'required|boolean',
            'form_fields.*.columns.*.unit' => 'nullable|string|max:50',
            'form_fields.*.columns.*.options' => 'nullable|array',
            'form_fields.*.columns.*.options.*' => 'string|max:100',
            'form_fields.*.columns.*.list_id' => 'nullable|integer|exists:form_option_lists,id',
            'form_fields.*.columns.*.formula' => 'nullable|string|max:255',
        ];
    }

    private function assertUsableFormFields(array $fields): void
    {
        $this->forms->validateSchema($fields);
    }

    public function destroy(Request $request, TestType $testType): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        if ($testType->orderItems()->exists()) {
            return response()->json([
                'message' => 'Ce type d’essai est utilisé sur des commandes : il ne peut pas être supprimé.',
            ], 422);
        }

        if ($testType->taskForms()->exists()) {
            return response()->json(['message' => 'Ce type d’essai est utilisé par des formulaires de tâche ; il ne peut pas être supprimé.'], 422);
        }

        $testType->delete();

        return response()->json(null, 204);
    }
}
