<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActionMeasureConfig;
use App\Models\ArticleAction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ActionMeasureConfigController extends Controller
{
    /** GET /articles/{article}/actions/{action}/measures */
    public function index(int $articleId, int $actionId): JsonResponse
    {
        $action = ArticleAction::where('id', $actionId)
            ->where('ref_article_id', $articleId)
            ->firstOrFail();

        return response()->json(
            $action->measureConfigs()->get()
        );
    }

    /** POST /articles/{article}/actions/{action}/measures */
    public function store(Request $request, int $articleId, int $actionId): JsonResponse
    {
        $action = ArticleAction::where('id', $actionId)
            ->where('ref_article_id', $articleId)
            ->firstOrFail();

        $data = $request->validate([
            'field_name'     => 'required|string|max:128',
            'field_type'     => 'required|in:number,text,select,date,file,boolean',
            'unit'           => 'nullable|string|max:32',
            'min_value'      => 'nullable|numeric',
            'max_value'      => 'nullable|numeric',
            'select_options' => 'nullable|array',
            'is_required'    => 'boolean',
            'placeholder'    => 'nullable|string|max:255',
            'help_text'      => 'nullable|string',
            'ordre'          => 'integer|min:0',
        ]);

        $config = $action->measureConfigs()->create($data);
        return response()->json($config, 201);
    }

    /** PUT /articles/{article}/actions/{action}/measures/{measure} */
    public function update(Request $request, int $articleId, int $actionId, int $configId): JsonResponse
    {
        $action = ArticleAction::where('id', $actionId)
            ->where('ref_article_id', $articleId)
            ->firstOrFail();

        $config = ActionMeasureConfig::where('id', $configId)
            ->where('article_action_id', $action->id)
            ->firstOrFail();

        $data = $request->validate([
            'field_name'     => 'string|max:128',
            'field_type'     => 'in:number,text,select,date,file,boolean',
            'unit'           => 'nullable|string|max:32',
            'min_value'      => 'nullable|numeric',
            'max_value'      => 'nullable|numeric',
            'select_options' => 'nullable|array',
            'is_required'    => 'boolean',
            'placeholder'    => 'nullable|string|max:255',
            'help_text'      => 'nullable|string',
            'ordre'          => 'integer|min:0',
        ]);

        $config->update($data);
        return response()->json($config->fresh());
    }

    /** DELETE /articles/{article}/actions/{action}/measures/{measure} */
    public function destroy(int $articleId, int $actionId, int $configId): JsonResponse
    {
        $action = ArticleAction::where('id', $actionId)
            ->where('ref_article_id', $articleId)
            ->firstOrFail();

        ActionMeasureConfig::where('id', $configId)
            ->where('article_action_id', $action->id)
            ->firstOrFail()
            ->delete();

        return response()->json(null, 204);
    }
}
