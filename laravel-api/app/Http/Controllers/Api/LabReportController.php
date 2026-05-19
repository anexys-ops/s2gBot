<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LabReport;
use App\Models\LabReportSection;
use App\Models\Sequence;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LabReportController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = LabReport::with([
            'sections',
            'technician:id,name,email',
        ]);

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        if ($bcId = $request->query('bc_id')) {
            $query->where('bc_id', $bcId);
        }

        if ($dossierId = $request->query('dossier_id')) {
            $query->where('dossier_id', $dossierId);
        }

        $reports = $query->orderByDesc('created_at')
            ->paginate((int) $request->query('per_page', 50));

        return response()->json($reports);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title'         => 'required|string|max:255',
            'bc_id'         => 'nullable|exists:bon_commandes,id',
            'dossier_id'    => 'nullable|exists:dossiers,id',
            'client_id'     => 'nullable|exists:clients,id',
            'site_id'       => 'nullable|exists:sites,id',
            'technician_id' => 'nullable|exists:users,id',
            'conclusion'    => 'nullable|string',
            'notes_internes' => 'nullable|string',
            'sections'      => 'sometimes|array',
            'sections.*.essai_article_id' => 'nullable|exists:ref_articles,id',
            'sections.*.sample_id'        => 'nullable|exists:samples,id',
            'sections.*.technician_id'    => 'nullable|exists:users,id',
            'sections.*.equipment_id'     => 'nullable|exists:equipments,id',
            'sections.*.ordre'            => 'nullable|integer|min:0',
            'sections.*.performed_at'     => 'nullable|date',
            'sections.*.temperature_c'    => 'nullable|numeric',
            'sections.*.humidity_pct'     => 'nullable|numeric|between:0,100',
            'sections.*.data'             => 'nullable|array',
            'sections.*.conformity'       => 'nullable|string|max:64',
            'sections.*.conclusion'       => 'nullable|string',
        ]);

        $user   = $request->user();
        $number = Sequence::next('RPT');

        $report = LabReport::create(array_merge(
            collect($validated)->except('sections')->toArray(),
            [
                'number'       => $number,
                'status'       => 'brouillon',
                'agency_id'    => $user->agency_id,
                'technician_id' => $validated['technician_id'] ?? $user->id,
            ]
        ));

        foreach ($validated['sections'] ?? [] as $index => $sectionData) {
            $report->sections()->create(array_merge($sectionData, [
                'ordre' => $sectionData['ordre'] ?? $index,
            ]));
        }

        return response()->json(
            $report->load(['sections.essaiArticle', 'sections.sample', 'technician:id,name,email']),
            201
        );
    }

    public function show(int $id): JsonResponse
    {
        $report = LabReport::with([
            'sections.essaiArticle',
            'sections.sample',
            'sections.technician:id,name,email',
            'technician:id,name,email',
            'validator:id,name,email',
            'agency',
        ])->findOrFail($id);

        return response()->json($report);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $report = LabReport::findOrFail($id);

        $validated = $request->validate([
            'title'          => 'sometimes|string|max:255',
            'bc_id'          => 'nullable|exists:bon_commandes,id',
            'dossier_id'     => 'nullable|exists:dossiers,id',
            'client_id'      => 'nullable|exists:clients,id',
            'site_id'        => 'nullable|exists:sites,id',
            'technician_id'  => 'nullable|exists:users,id',
            'validator_id'   => 'nullable|exists:users,id',
            'conclusion'     => 'nullable|string',
            'notes_internes' => 'nullable|string',
        ]);

        $report->update($validated);

        return response()->json($report->load(['sections', 'technician:id,name,email', 'validator:id,name,email']));
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $report = LabReport::findOrFail($id);

        if ($report->status !== 'brouillon') {
            return response()->json(['message' => 'Seuls les rapports en brouillon peuvent être supprimés.'], 422);
        }

        $report->delete();

        return response()->json(null, 204);
    }

    public function transition(Request $request, int $id): JsonResponse
    {
        $report = LabReport::findOrFail($id);

        $validated = $request->validate([
            'status' => 'required|string|in:'.implode(',', LabReport::STATUSES),
        ]);

        $newStatus   = $validated['status'];
        $allowed     = LabReport::TRANSITIONS[$report->status] ?? [];

        if (! in_array($newStatus, $allowed, true)) {
            return response()->json([
                'message'      => 'Transition de statut non autorisée.',
                'current'      => $report->status,
                'requested'    => $newStatus,
                'allowed_next' => $allowed,
            ], 422);
        }

        $update = ['status' => $newStatus];

        if ($newStatus === 'signe') {
            $update['signed_at']   = now();
            $update['validator_id'] = $request->user()->id;
        }

        if ($newStatus === 'emis') {
            $update['emitted_at'] = now();
        }

        $report->update($update);

        return response()->json($report->fresh());
    }

    public function addSection(Request $request, int $id): JsonResponse
    {
        $report = LabReport::findOrFail($id);

        $validated = $request->validate([
            'essai_article_id' => 'nullable|exists:ref_articles,id',
            'sample_id'        => 'nullable|exists:samples,id',
            'technician_id'    => 'nullable|exists:users,id',
            'equipment_id'     => 'nullable|exists:equipments,id',
            'ordre'            => 'nullable|integer|min:0',
            'performed_at'     => 'nullable|date',
            'temperature_c'    => 'nullable|numeric',
            'humidity_pct'     => 'nullable|numeric|between:0,100',
            'data'             => 'nullable|array',
            'conformity'       => 'nullable|string|max:64',
            'conclusion'       => 'nullable|string',
        ]);

        if (! isset($validated['ordre'])) {
            $validated['ordre'] = $report->sections()->max('ordre') + 1;
        }

        $section = $report->sections()->create(array_merge(
            $validated,
            ['report_id' => $report->id]
        ));

        return response()->json($section->load(['essaiArticle', 'sample', 'technician:id,name,email']), 201);
    }

    public function updateSection(Request $request, int $id, int $sectionId): JsonResponse
    {
        $report  = LabReport::findOrFail($id);
        $section = LabReportSection::where('report_id', $report->id)->findOrFail($sectionId);

        $validated = $request->validate([
            'performed_at'  => 'nullable|date',
            'temperature_c' => 'nullable|numeric',
            'humidity_pct'  => 'nullable|numeric|between:0,100',
            'data'          => 'nullable|array',
            'conformity'    => 'nullable|string|max:64',
            'conclusion'    => 'nullable|string',
            'ordre'         => 'nullable|integer|min:0',
        ]);

        $section->update($validated);

        return response()->json($section->load(['essaiArticle', 'sample']));
    }

    public function removeSection(int $id, int $sectionId): JsonResponse
    {
        $report  = LabReport::findOrFail($id);
        $section = LabReportSection::where('report_id', $report->id)->findOrFail($sectionId);

        $section->delete();

        return response()->json(null, 204);
    }
}
