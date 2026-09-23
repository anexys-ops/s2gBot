<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Models\ExpenseLine;
use App\Models\ExpenseReport;
use App\Models\MaterielAffectation;
use App\Models\MissionTask;
use App\Models\OrdreMission;
use App\Models\PlanningEquipment;
use App\Models\PlanningEvent;
use App\Support\UserExpenseBareme;
use App\Services\ExpenseReportService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class MobileTerrainController extends Controller
{
    public function calendar(Request $request): JsonResponse
    {
        $dates = $request->validate([
            'from' => 'required|date',
            'to' => 'required|date|after_or_equal:from',
        ]);
        $userId = $request->user()->id;
        $tasks = $this->ownTasks($userId)
            ->whereNotNull('planned_date')
            ->whereDate('planned_date', '<=', $dates['to'])
            ->where(fn (Builder $q) => $q->whereDate('due_date', '>=', $dates['from'])
                ->orWhere(fn (Builder $withoutDue) => $withoutDue->whereNull('due_date')
                    ->whereDate('planned_date', '>=', $dates['from'])))
            ->orderBy('planned_date')->get()->map(fn (MissionTask $task) => $this->taskPayload($task));

        $events = PlanningEvent::query()->with([
                'bonCommandeLigne.bonCommande.client:id,name',
                'bonCommandeLigne.bonCommande.dossier:id,reference,titre',
            ])
            ->where('user_id', $userId)
            ->whereNull('mission_task_id')
            ->whereNotIn('source_type', ['materiel_affectation', 'equipment'])
            ->whereDate('date_debut', '<=', $dates['to'])
            ->whereDate('date_fin', '>=', $dates['from'])
            ->orderBy('date_debut')->get([
                'id', 'source_type', 'bon_commande_ligne_id', 'date_debut', 'date_fin',
                'heure_debut', 'heure_fin', 'type_evenement', 'notes',
            ])->map(fn (PlanningEvent $event) => [
                'id' => $event->id,
                'source_type' => $event->source_type,
                'date_debut' => $event->date_debut?->format('Y-m-d'),
                'date_fin' => $event->date_fin?->format('Y-m-d'),
                'heure_debut' => $event->heure_debut,
                'heure_fin' => $event->heure_fin,
                'type_evenement' => $event->type_evenement,
                'notes' => $event->notes,
                'libelle' => $event->bonCommandeLigne?->libelle,
                'bon_commande' => $event->bonCommandeLigne?->bonCommande?->only(['id', 'numero']),
                'client' => $event->bonCommandeLigne?->bonCommande?->client?->only(['id', 'name']),
                'dossier' => $event->bonCommandeLigne?->bonCommande?->dossier?->only(['id', 'reference', 'titre']),
            ]);

        $equipmentMovements = MaterielAffectation::query()->with('equipment')
            ->where('user_id', $userId)
            ->whereDate('date_debut', '<=', $dates['to'])
            ->where(fn (Builder $q) => $q->whereDate('date_debut', '>=', $dates['from'])
                ->orWhereDate('date_retour_effective', '>=', $dates['from'])
                ->orWhere(fn (Builder $pending) => $pending->whereNull('date_retour_effective')
                    ->whereDate('date_retour_prevue', '>=', $dates['from'])))
            ->orderBy('date_debut')->get()->map(fn (MaterielAffectation $row) => [
                'id' => $row->id,
                'ordre_mission_id' => $row->ordre_mission_id,
                'equipment' => $row->equipment?->only(['id', 'name', 'code', 'type', 'status']),
                'a_recuperer_le' => $row->date_debut?->format('Y-m-d'),
                'a_deposer_le' => $row->date_retour_effective?->format('Y-m-d')
                    ?? $row->date_retour_prevue?->format('Y-m-d'),
            ]);

        return response()->json(['tasks' => $tasks, 'events' => $events, 'equipment_movements' => $equipmentMovements]);
    }

    public function tasks(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'from' => 'sometimes|date',
            'to' => 'sometimes|date|after_or_equal:from',
            'statut' => ['sometimes', Rule::in(MissionTask::statuts())],
            'active_only' => 'sometimes|boolean',
        ]);
        $query = $this->ownTasks($request->user()->id);
        if (isset($filters['from'])) {
            $query->where(fn (Builder $q) => $q->whereDate('planned_date', '>=', $filters['from'])
                ->orWhereDate('due_date', '>=', $filters['from']));
        }
        if (isset($filters['to'])) {
            $query->whereDate('planned_date', '<=', $filters['to']);
        }
        if (isset($filters['statut'])) {
            $query->where('statut', $filters['statut']);
        }
        if ($request->boolean('active_only')) {
            $query->whereNotIn('statut', [MissionTask::STATUT_DONE, MissionTask::STATUT_VALIDATED, MissionTask::STATUT_REJECTED]);
        }

        return response()->json($query->orderBy('planned_date')->orderBy('id')->get()
            ->map(fn (MissionTask $task) => $this->taskPayload($task)));
    }

    public function task(Request $request, MissionTask $task): JsonResponse
    {
        abort_unless($this->ownTasks($request->user()->id)->whereKey($task->id)->exists(), 403);
        $task->load([
            'ordreMissionLigne.ordreMission.client',
            'ordreMissionLigne.ordreMission.site',
            'ordreMissionLigne.ordreMission.dossier',
            'ordreMissionLigne.ordreMission.bonCommande',
            'ordreMissionLigne.equipment',
            'planningEquipments.equipment',
        ]);
        $om = $task->ordreMissionLigne?->ordreMission;

        return response()->json([
            ...$this->taskPayload($task),
            'client' => $om?->client?->only(['id', 'name', 'address', 'city', 'phone', 'email', 'lat', 'lng']),
            'site' => $om?->site?->only(['id', 'name', 'address', 'latitude', 'longitude']),
            'dossier' => $om?->dossier?->only(['id', 'reference', 'titre']),
            'equipment' => $this->equipmentForTask($task),
        ]);
    }

    public function expenses(Request $request): JsonResponse
    {
        return response()->json(ExpenseReport::query()->with(['lines', 'ordreMission:id,numero'])
            ->where('user_id', $request->user()->id)
            ->orderByDesc('id')->get());
    }

    public function expenseOptions(Request $request): JsonResponse
    {
        $oms = OrdreMission::query()->whereIn('type', [OrdreMission::TYPE_TECHNICIEN, OrdreMission::TYPE_INGENIEUR])
            ->whereHas('lignes.missionTasks', fn (Builder $q) => $q->where('assigned_user_id', $request->user()->id))
            ->whereIn('statut', [OrdreMission::STATUT_PLANIFIE, OrdreMission::STATUT_EN_COURS, OrdreMission::STATUT_TERMINE])
            ->orderByDesc('id')->get(['id', 'numero', 'type', 'client_id', 'dossier_id']);

        return response()->json([
            'ordres_mission' => $oms,
            'categories' => ExpenseLine::CATEGORIES,
            'payment_methods' => ExpenseLine::PAYMENT_METHODS,
            'bareme' => UserExpenseBareme::forUser($request->user()),
        ]);
    }

    public function storeExpense(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ordre_mission_id' => 'required|integer|exists:ordres_mission,id',
            'notes' => 'nullable|string|max:2000',
        ]);
        abort_unless($this->ownsMission($request->user()->id, (int) $data['ordre_mission_id']), 403);
        $report = ExpenseReport::query()->create([
            ...$data,
            'user_id' => $request->user()->id,
            'created_by' => $request->user()->id,
            'statut' => ExpenseReport::STATUT_BROUILLON,
        ]);

        return response()->json($report->load('lines'), 201);
    }

    public function storeExpenseLine(Request $request, ExpenseReport $expenseReport, ExpenseReportService $service): JsonResponse
    {
        abort_unless($expenseReport->user_id === $request->user()->id, 403);
        abort_unless($expenseReport->statut === ExpenseReport::STATUT_BROUILLON, 422);
        $data = $request->validate([
            'category' => ['required', Rule::in(ExpenseLine::CATEGORIES)],
            'amount' => 'nullable|numeric|min:0',
            'payment_method' => ['nullable', Rule::in(ExpenseLine::PAYMENT_METHODS)],
            'date' => 'required|date',
            'description' => 'nullable|string|max:512',
            'lieu_depart' => 'nullable|string|max:255',
            'lieu_arrivee' => 'nullable|string|max:255',
            'distance_km' => 'nullable|numeric|min:0',
            'taux_km' => 'nullable|numeric|min:0',
            'type_transport' => 'nullable|in:voiture,moto,velo,transports_commun,autre',
        ]);
        $bareme = UserExpenseBareme::forUser($request->user());
        if (isset($data['distance_km'])) {
            $data['taux_km'] ??= $bareme['taux_km'];
            $data['amount'] ??= $service->computeDeplacementAmount((float) $data['distance_km'], (float) $data['taux_km']);
        }
        if ($data['category'] === 'Repas' && ($data['amount'] ?? 0) <= 0 && $bareme['forfait_repas'] !== null) {
            $data['amount'] = $bareme['forfait_repas'];
        }
        $line = $expenseReport->lines()->create([
            ...$data,
            'user_id' => $request->user()->id,
            'amount' => max(0, (float) ($data['amount'] ?? 0)),
        ]);

        return response()->json($line, 201);
    }

    public function submitExpense(Request $request, ExpenseReport $expenseReport): JsonResponse
    {
        abort_unless($expenseReport->user_id === $request->user()->id, 403);
        abort_unless($expenseReport->statut === ExpenseReport::STATUT_BROUILLON, 422);
        abort_unless($expenseReport->lines()->exists(), 422, 'Ajoutez au moins une ligne avant de soumettre la note.');
        $expenseReport->update(['statut' => ExpenseReport::STATUT_SOUMIS]);

        return response()->json($expenseReport->fresh('lines'));
    }

    private function ownTasks(int $userId): Builder
    {
        return MissionTask::query()->where('assigned_user_id', $userId)
            ->whereHas('ordreMissionLigne.ordreMission', fn (Builder $q) => $q
                ->whereIn('type', [OrdreMission::TYPE_TECHNICIEN, OrdreMission::TYPE_INGENIEUR])
                ->where('statut', '!=', OrdreMission::STATUT_ANNULE))
            ->with([
                'ordreMissionLigne.ordreMission.client:id,name',
                'ordreMissionLigne.ordreMission.site:id,name',
                'ordreMissionLigne.ordreMission.dossier:id,reference,titre',
                'ordreMissionLigne.ordreMission.bonCommande:id,numero',
            ]);
    }

    private function ownsMission(int $userId, int $missionId): bool
    {
        return $this->ownTasks($userId)->whereHas('ordreMissionLigne', fn (Builder $q) => $q
            ->where('ordre_mission_id', $missionId))->exists();
    }

    private function taskPayload(MissionTask $task): array
    {
        $line = $task->ordreMissionLigne;
        $om = $line?->ordreMission;

        return [
            'id' => $task->id,
            'numero' => $task->unique_number,
            'statut' => $task->statut,
            'planned_date' => $task->planned_date?->format('Y-m-d'),
            'due_date' => $task->due_date?->format('Y-m-d'),
            'notes' => $task->notes,
            'libelle' => $line?->libelle,
            'quantite' => $line?->quantite,
            'ordre_mission' => $om?->only(['id', 'numero', 'type', 'statut']),
            'bon_commande' => $om?->bonCommande?->only(['id', 'numero']),
            'client' => $om?->client?->only(['id', 'name']),
            'site' => $om?->site?->only(['id', 'name']),
            'dossier' => $om?->dossier?->only(['id', 'reference', 'titre']),
        ];
    }

    private function equipmentForTask(MissionTask $task): array
    {
        $line = $task->ordreMissionLigne;
        $om = $line?->ordreMission;
        $equipment = collect();
        if ($line?->equipment) {
            $equipment->push(['source' => 'ligne_om', 'equipment' => $line->equipment->only(['id', 'name', 'code', 'type', 'status'])]);
        }
        foreach ($task->planningEquipments as $slot) {
            if ($slot->equipment) {
                $equipment->push([
                    'source' => 'planning',
                    'equipment' => $slot->equipment->only(['id', 'name', 'code', 'type', 'status']),
                    'date_debut' => $slot->date_debut?->format('Y-m-d'),
                    'date_fin' => $slot->date_fin?->format('Y-m-d'),
                ]);
            }
        }
        if ($om) {
            foreach (MaterielAffectation::query()->with('equipment')->where('ordre_mission_id', $om->id)
                ->where('user_id', $task->assigned_user_id)->get() as $affectation) {
                if ($affectation->equipment) {
                    $equipment->push([
                        'source' => 'affectation',
                        'equipment' => $affectation->equipment->only(['id', 'name', 'code', 'type', 'status']),
                        'a_recuperer_le' => $affectation->date_debut?->format('Y-m-d'),
                        'a_deposer_le' => $affectation->date_retour_effective?->format('Y-m-d')
                            ?? $affectation->date_retour_prevue?->format('Y-m-d'),
                        'etat_depart' => $affectation->etat_depart,
                        'etat_retour' => $affectation->etat_retour,
                    ]);
                }
            }
        }

        return $equipment->all();
    }
}
