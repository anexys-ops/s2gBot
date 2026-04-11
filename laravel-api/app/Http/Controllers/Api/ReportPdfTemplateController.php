<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ReportPdfTemplate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportPdfTemplateController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        return response()->json([
            'data' => ReportPdfTemplate::query()->orderBy('name')->get(),
        ]);
    }

    public function update(Request $request, ReportPdfTemplate $reportPdfTemplate): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'is_default' => 'sometimes|boolean',
            'name' => 'sometimes|string|max:255',
        ]);

        if (($validated['is_default'] ?? false) === true) {
            ReportPdfTemplate::query()->where('id', '!=', $reportPdfTemplate->id)->update(['is_default' => false]);
            $reportPdfTemplate->is_default = true;
        }
        if (isset($validated['name'])) {
            $reportPdfTemplate->name = $validated['name'];
        }
        $reportPdfTemplate->save();

        return response()->json($reportPdfTemplate->fresh());
    }
}
