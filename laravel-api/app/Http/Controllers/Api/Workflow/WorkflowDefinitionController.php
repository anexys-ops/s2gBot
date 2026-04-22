<?php

namespace App\Http\Controllers\Api\Workflow;

use App\Http\Controllers\Controller;
use App\Models\WorkflowDefinition;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WorkflowDefinitionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $q = WorkflowDefinition::query()->with('steps')->orderBy('name');
        if ($request->query('active_only') === '1' || $request->query('active_only') === 'true') {
            $q->where('active', true);
        }
        if ($type = trim((string) $request->query('document_type', ''))) {
            $q->where('document_type', $type);
        }

        return response()->json($q->get());
    }

    public function show(Request $request, WorkflowDefinition $workflowDefinition): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $workflowDefinition->load(['steps', 'transitions.fromStep', 'transitions.toStep']);

        return response()->json($workflowDefinition);
    }
}
