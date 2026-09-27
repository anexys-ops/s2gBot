<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FormOptionList;
use App\Models\TestType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FormOptionListController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(FormOptionList::query()->orderBy('name')->get());
    }

    public function store(Request $request): JsonResponse
    {
        abort_unless($request->user()->isLabAdmin(), 403);
        $data = $request->validate([
            'name' => 'required|string|max:255|unique:form_option_lists,name',
            'options' => 'required|array|min:1',
            'options.*' => 'required|string|max:100|distinct',
        ]);
        return response()->json(FormOptionList::query()->create($data), 201);
    }

    public function update(Request $request, FormOptionList $formOptionList): JsonResponse
    {
        abort_unless($request->user()->isLabAdmin(), 403);
        $data = $request->validate([
            'name' => 'sometimes|required|string|max:255|unique:form_option_lists,name,'.$formOptionList->id,
            'options' => 'sometimes|required|array|min:1',
            'options.*' => 'required|string|max:100|distinct',
        ]);
        $formOptionList->update($data);
        return response()->json($formOptionList->fresh());
    }

    public function destroy(Request $request, FormOptionList $formOptionList): JsonResponse
    {
        abort_unless($request->user()->isLabAdmin(), 403);
        foreach (TestType::query()->whereNotNull('form_fields')->get(['form_fields']) as $type) {
            foreach ($type->form_fields ?? [] as $field) {
                if (($field['list_id'] ?? null) === $formOptionList->id) {
                    return response()->json(['message' => 'Cette liste est utilisée dans un formulaire d’essai.'], 422);
                }
                foreach ($field['columns'] ?? [] as $column) {
                    if (($column['list_id'] ?? null) === $formOptionList->id) {
                        return response()->json(['message' => 'Cette liste est utilisée dans un formulaire d’essai.'], 422);
                    }
                }
            }
        }
        $formOptionList->delete();
        return response()->json(null, 204);
    }
}
