<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MailTemplate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MailTemplateController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        return response()->json(['data' => MailTemplate::orderBy('name')->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:100|unique:mail_templates,name',
            'subject' => 'required|string|max:255',
            'body' => 'required|string',
            'description' => 'nullable|string|max:255',
        ]);

        $template = MailTemplate::create($validated);

        return response()->json($template, 201);
    }

    public function update(Request $request, MailTemplate $mailTemplate): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:100|unique:mail_templates,name,'.$mailTemplate->id,
            'subject' => 'sometimes|string|max:255',
            'body' => 'sometimes|string',
            'description' => 'nullable|string|max:255',
        ]);

        $mailTemplate->update($validated);

        return response()->json($mailTemplate);
    }

    public function destroy(Request $request, MailTemplate $mailTemplate): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $mailTemplate->delete();

        return response()->json(null, 204);
    }
}
