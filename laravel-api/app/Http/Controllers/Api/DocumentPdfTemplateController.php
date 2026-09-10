<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DocumentPdfTemplate;
use App\Support\AppBranding;
use App\Support\PdfTemplateResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class DocumentPdfTemplateController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $query = DocumentPdfTemplate::query()->orderBy('document_type')->orderBy('name');
        if ($request->filled('document_type')) {
            $query->where('document_type', $request->query('document_type'));
        }
        if ($request->boolean('active_only')) {
            $query->where('is_active', true);
        }

        return response()->json([
            'data' => $query->get()->map(fn (DocumentPdfTemplate $t) => $this->serializeTemplate($t)),
        ]);
    }

    public function options(Request $request): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        return response()->json([
            'document_types' => PdfTemplateResolver::DOCUMENT_TYPES,
            'blade_views' => collect(PdfTemplateResolver::DOCUMENT_TYPES)
                ->mapWithKeys(fn (string $type) => [$type => PdfTemplateResolver::bladeViewsForType($type)])
                ->all(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'document_type' => ['required', Rule::in(PdfTemplateResolver::DOCUMENT_TYPES)],
            'name' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255|unique:document_pdf_templates,slug',
            'blade_view' => 'nullable|string|max:255',
            'layout_config' => 'sometimes|array',
            'is_default' => 'sometimes|boolean',
            'is_active' => 'sometimes|boolean',
            'clone_from_id' => 'nullable|integer|exists:document_pdf_templates,id',
        ]);

        $documentType = $validated['document_type'];
        $allowedBlades = PdfTemplateResolver::bladeViewsForType($documentType);
        $bladeView = $validated['blade_view'] ?? PdfTemplateResolver::defaultBladeView($documentType);
        if ($allowedBlades !== [] && ! in_array($bladeView, $allowedBlades, true)) {
            return response()->json(['message' => 'Vue Blade invalide pour ce type de document.'], 422);
        }

        $layoutConfig = AppBranding::defaultLayoutConfig();
        if (! empty($validated['clone_from_id'])) {
            $source = DocumentPdfTemplate::query()->findOrFail((int) $validated['clone_from_id']);
            if ($source->document_type !== $documentType) {
                return response()->json(['message' => 'Le modèle source doit être du même type de document.'], 422);
            }
            $layoutConfig = AppBranding::mergeLayoutConfig($source->layout_config);
            if (empty($validated['blade_view'])) {
                $bladeView = $source->blade_view;
            }
        }
        if (isset($validated['layout_config'])) {
            $layoutConfig = AppBranding::mergeLayoutConfig(array_replace_recursive(
                $layoutConfig,
                $validated['layout_config'],
            ));
        }

        $slug = isset($validated['slug']) && trim($validated['slug']) !== ''
            ? Str::slug($validated['slug'])
            : $this->uniqueSlug($validated['name']);

        $isDefault = (bool) ($validated['is_default'] ?? false);
        if ($isDefault) {
            DocumentPdfTemplate::query()
                ->where('document_type', $documentType)
                ->update(['is_default' => false]);
        }

        $template = DocumentPdfTemplate::create([
            'document_type' => $documentType,
            'slug' => $slug,
            'name' => trim($validated['name']),
            'blade_view' => $bladeView,
            'is_default' => $isDefault,
            'is_active' => $validated['is_active'] ?? true,
            'layout_config' => $layoutConfig,
        ]);

        return response()->json($this->serializeTemplate($template), 201);
    }

    public function show(Request $request, DocumentPdfTemplate $documentPdfTemplate): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        return response()->json($this->serializeTemplate($documentPdfTemplate));
    }

    public function update(Request $request, DocumentPdfTemplate $documentPdfTemplate): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'is_default' => 'sometimes|boolean',
            'is_active' => 'sometimes|boolean',
            'name' => 'sometimes|string|max:255',
            'blade_view' => 'sometimes|string|max:255',
            'layout_config' => 'sometimes|array',
        ]);

        if (isset($validated['blade_view'])) {
            $allowed = PdfTemplateResolver::bladeViewsForType($documentPdfTemplate->document_type);
            if ($allowed !== [] && ! in_array($validated['blade_view'], $allowed, true)) {
                return response()->json(['message' => 'Vue Blade invalide pour ce type de document.'], 422);
            }
            $documentPdfTemplate->blade_view = $validated['blade_view'];
        }

        if (array_key_exists('is_default', $validated) && $validated['is_default']) {
            DocumentPdfTemplate::query()
                ->where('document_type', $documentPdfTemplate->document_type)
                ->where('id', '!=', $documentPdfTemplate->id)
                ->update(['is_default' => false]);
            $documentPdfTemplate->is_default = true;
        }

        if (array_key_exists('is_active', $validated)) {
            if (! $validated['is_active'] && $documentPdfTemplate->is_default) {
                return response()->json([
                    'message' => 'Impossible de désactiver le modèle par défaut. Choisissez d’abord un autre modèle par défaut.',
                ], 422);
            }
            $documentPdfTemplate->is_active = $validated['is_active'];
        }

        if (isset($validated['name'])) {
            $documentPdfTemplate->name = $validated['name'];
        }
        if (array_key_exists('layout_config', $validated)) {
            $documentPdfTemplate->layout_config = AppBranding::mergeLayoutConfig($validated['layout_config']);
        }

        $documentPdfTemplate->save();

        return response()->json($this->serializeTemplate($documentPdfTemplate->fresh()));
    }

    public function destroy(Request $request, DocumentPdfTemplate $documentPdfTemplate): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        if ($documentPdfTemplate->is_default) {
            return response()->json([
                'message' => 'Impossible de supprimer le modèle par défaut. Choisissez d’abord un autre modèle par défaut.',
            ], 422);
        }

        $siblingCount = DocumentPdfTemplate::query()
            ->where('document_type', $documentPdfTemplate->document_type)
            ->count();
        if ($siblingCount <= 1) {
            return response()->json([
                'message' => 'Impossible de supprimer le dernier modèle pour ce type de document.',
            ], 422);
        }

        $documentPdfTemplate->delete();

        return response()->json(null, 204);
    }

    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name);
        if ($base === '') {
            $base = 'modele-pdf';
        }
        $slug = $base;
        $i = 2;
        while (DocumentPdfTemplate::query()->where('slug', $slug)->exists()) {
            $slug = $base.'-'.$i;
            $i++;
        }

        return $slug;
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeTemplate(DocumentPdfTemplate $t): array
    {
        return [
            'id' => $t->id,
            'document_type' => $t->document_type,
            'slug' => $t->slug,
            'name' => $t->name,
            'blade_view' => $t->blade_view,
            'is_default' => $t->is_default,
            'is_active' => $t->is_active,
            'layout_config' => AppBranding::mergeLayoutConfig($t->layout_config),
        ];
    }
}
