<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ExpenseLine;
use App\Models\ExpenseReport;
use App\Models\OrdreMission;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ExpenseReportController extends Controller
{
    // ── Liste des NDF ────────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $q = ExpenseReport::with(['ordreMission.dossier', 'createdBy', 'validatedBy', 'lines'])
            ->when($request->statut, fn ($qb, $v) => $qb->where('statut', $v))
            ->when($request->ordre_mission_id, fn ($qb, $v) => $qb->where('ordre_mission_id', $v))
            ->orderByDesc('id');

        return response()->json($q->paginate(20));
    }

    // ── OMs éligibles pour créer une NDF (terrain/ingenieur, validés/terminés) ─

    public function eligibleOrdresMission(): JsonResponse
    {
        $oms = OrdreMission::with(['dossier', 'client', 'site'])
            ->whereIn('type', [OrdreMission::TYPE_TECHNICIEN, OrdreMission::TYPE_INGENIEUR])
            ->whereIn('statut', [OrdreMission::STATUT_EN_COURS, OrdreMission::STATUT_TERMINE])
            ->orderByDesc('id')
            ->get();

        return response()->json($oms);
    }

    // ── Créer une NDF ────────────────────────────────────────────────────────

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ordre_mission_id' => 'required|exists:ordres_mission,id',
            'notes'            => 'nullable|string',
        ]);
        $data['created_by'] = Auth::id();
        $data['statut']     = ExpenseReport::STATUT_BROUILLON;

        $report = ExpenseReport::create($data);
        $report->load(['ordreMission', 'createdBy', 'lines']);

        return response()->json($report, 201);
    }

    // ── Détail d'une NDF ─────────────────────────────────────────────────────

    public function show(ExpenseReport $expenseReport): JsonResponse
    {
        $expenseReport->load(['ordreMission.dossier', 'createdBy', 'validatedBy', 'lines.user']);
        $expenseReport->append('total');

        return response()->json($expenseReport);
    }

    // ── Modifier statut / notes ──────────────────────────────────────────────

    public function update(Request $request, ExpenseReport $expenseReport): JsonResponse
    {
        $data = $request->validate([
            'statut' => 'sometimes|in:brouillon,soumis,valide,rembourse,rejete',
            'notes'  => 'nullable|string',
        ]);

        if (isset($data['statut']) && $data['statut'] === ExpenseReport::STATUT_VALIDE) {
            $data['validated_by'] = Auth::id();
            $data['validated_at'] = now();
        }

        $expenseReport->update($data);
        $expenseReport->load(['ordreMission', 'createdBy', 'validatedBy', 'lines']);
        $expenseReport->append('total');

        return response()->json($expenseReport);
    }

    // ── Supprimer (soft) ─────────────────────────────────────────────────────

    public function destroy(ExpenseReport $expenseReport): JsonResponse
    {
        $expenseReport->delete();

        return response()->json(['message' => 'Supprimé']);
    }

    // ── Ajouter une ligne ────────────────────────────────────────────────────

    public function storeLine(Request $request, ExpenseReport $expenseReport): JsonResponse
    {
        $data = $request->validate([
            'user_id'     => 'required|exists:users,id',
            'category'    => 'required|in:' . implode(',', ExpenseLine::CATEGORIES),
            'amount'      => 'required|numeric|min:0',
            'date'        => 'required|date',
            'description' => 'nullable|string|max:512',
            'receipt_path' => 'nullable|string|max:512',
        ]);
        $data['expense_report_id'] = $expenseReport->id;

        $line = ExpenseLine::create($data);

        return response()->json($line, 201);
    }

    // ── Modifier une ligne ───────────────────────────────────────────────────

    public function updateLine(Request $request, ExpenseReport $expenseReport, ExpenseLine $line): JsonResponse
    {
        $data = $request->validate([
            'user_id'      => 'sometimes|exists:users,id',
            'category'     => 'sometimes|in:' . implode(',', ExpenseLine::CATEGORIES),
            'amount'       => 'sometimes|numeric|min:0',
            'date'         => 'sometimes|date',
            'description'  => 'nullable|string|max:512',
            'receipt_path' => 'nullable|string|max:512',
        ]);

        $line->update($data);

        return response()->json($line);
    }

    // ── Supprimer une ligne ──────────────────────────────────────────────────

    public function destroyLine(ExpenseReport $expenseReport, ExpenseLine $line): JsonResponse
    {
        $line->delete();

        return response()->json(['message' => 'Ligne supprimée']);
    }
}
