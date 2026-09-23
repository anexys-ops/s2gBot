<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TestType;
use App\Models\TestTypeParam;
use App\Models\ArticleAction;
use App\Models\Catalogue\Article;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class TestTypeController extends Controller
{
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
            ...$this->formFieldRules(),
            'params' => 'nullable|array',
            'params.*.name' => 'required|string|max:255',
            'params.*.unit' => 'nullable|string|max:50',
            'params.*.expected_type' => 'nullable|in:numeric,text,date',
        ]);
        $this->assertUsableFormFields($validated['form_fields'] ?? []);

        $params = $validated['params'] ?? [];
        unset($validated['params']);

        $testType = TestType::create($validated);

        foreach ($params as $p) {
            $testType->params()->create([
                'name' => $p['name'],
                'unit' => $p['unit'] ?? null,
                'expected_type' => $p['expected_type'] ?? 'numeric',
            ]);
        }

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
            'assignments' => 'required|array',
            'assignments.*.article_id' => 'required|integer|distinct|exists:ref_articles,id',
            'assignments.*.article_action_id' => 'nullable|integer|exists:article_actions,id',
        ]);
        if ($data['assignments'] !== [] && empty($testType->form_fields)) {
            return response()->json(['message' => 'Ajoutez au moins un champ de formulaire avant d’affecter ce type d’essai à un produit.'], 422);
        }
        $sync = [];
        foreach ($data['assignments'] as $assignment) {
            $article = Article::query()->findOrFail($assignment['article_id']);
            if (! $article->isProduct()) {
                return response()->json(['message' => 'Le type d’essai doit être associé à un produit.'], 422);
            }
            $actionId = $assignment['article_action_id'] ?? null;
            if ($actionId && ! ArticleAction::query()->whereKey($actionId)->where('ref_article_id', $article->id)->exists()) {
                return response()->json(['message' => 'Cette action n’appartient pas au produit.'], 422);
            }
            $sync[$article->id] = ['article_action_id' => $actionId];
        }
        $testType->articles()->sync($sync);

        return response()->json($testType->fresh()->load(['params', 'articles:id,code,libelle']));
    }

    private function formFieldRules(): array
    {
        return [
            'form_fields' => 'nullable|array',
            'form_fields.*.key' => 'required|string|alpha_dash|max:100|distinct',
            'form_fields.*.label' => 'required|string|max:255',
            'form_fields.*.type' => 'required|in:number,text,date,select,boolean,photo',
            'form_fields.*.required' => 'required|boolean',
            'form_fields.*.unit' => 'nullable|string|max:50',
            'form_fields.*.options' => 'nullable|array',
            'form_fields.*.options.*' => 'string|max:100',
        ];
    }

    private function assertUsableFormFields(array $fields): void
    {
        foreach ($fields as $index => $field) {
            if ($field['type'] === 'select' && empty($field['options'])) {
                throw ValidationException::withMessages(["form_fields.$index.options" => 'Ajoutez au moins un choix.']);
            }
        }
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
