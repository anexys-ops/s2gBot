<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ReportPdfTemplate;
use App\Support\AppBranding;
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
            'data' => ReportPdfTemplate::query()->orderBy('name')->get()->map(fn (ReportPdfTemplate $t) => [
                'id' => $t->id,
                'slug' => $t->slug,
                'name' => $t->name,
                'blade_view' => $t->blade_view,
                'is_default' => $t->is_default,
                'layout_config' => AppBranding::mergeLayoutConfig($t->layout_config),
            ]),
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
            'layout_config' => 'sometimes|array',
        ]);

        if (($validated['is_default'] ?? false) === true) {
            ReportPdfTemplate::query()->where('id', '!=', $reportPdfTemplate->id)->update(['is_default' => false]);
            $reportPdfTemplate->is_default = true;
        }
        if (isset($validated['name'])) {
            $reportPdfTemplate->name = $validated['name'];
        }
        if (array_key_exists('layout_config', $validated)) {
            $reportPdfTemplate->layout_config = AppBranding::mergeLayoutConfig($validated['layout_config']);
        }
        $reportPdfTemplate->save();
        $m = $reportPdfTemplate->fresh();

        return response()->json(array_merge($m->toArray(), [
            'layout_config' => AppBranding::mergeLayoutConfig($m->layout_config),
        ]));
    }
}
