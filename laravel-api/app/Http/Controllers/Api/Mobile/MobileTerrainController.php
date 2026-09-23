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
use App\Services\MissionTaskStatusService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

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

    public function updateTaskStatus(Request $request, MissionTask $task, MissionTaskStatusService $statusSync): JsonResponse
    {
        if (is_string($request->input('motif'))) {
            $request->merge(['motif' => trim($request->input('motif'))]);
        }
        $data = $request->validate([
            'statut' => ['required', Rule::in([
                MissionTask::STATUT_IN_PROGRESS,
                MissionTask::STATUT_PAUSED,
                MissionTask::STATUT_DONE,
                MissionTask::STATUT_REJECTED,
            ])],
            'motif' => 'required_if:statut,rejected|prohibited_unless:statut,rejected|string|min:3|max:2000',
        ]);

        DB::transaction(function () use ($request, $task, $data, $statusSync) {
            $locked = MissionTask::query()->lockForUpdate()->findOrFail($task->id);
            abort_unless($this->ownTasks($request->user()->id)->whereKey($locked->id)->exists(), 403);

            $allowedFrom = match ($data['statut']) {
                MissionTask::STATUT_IN_PROGRESS => [MissionTask::STATUT_TODO, MissionTask::STATUT_PAUSED, MissionTask::STATUT_RESCHEDULED],
                MissionTask::STATUT_PAUSED => [MissionTask::STATUT_IN_PROGRESS],
                MissionTask::STATUT_DONE => [MissionTask::STATUT_IN_PROGRESS],
                MissionTask::STATUT_REJECTED => [MissionTask::STATUT_TODO, MissionTask::STATUT_IN_PROGRESS, MissionTask::STATUT_PAUSED, MissionTask::STATUT_RESCHEDULED],
            };
            if (! in_array($locked->statut, $allowedFrom, true)) {
                throw ValidationException::withMessages([
                    'statut' => "Transition impossible de {$locked->statut} vers {$data['statut']}.",
                ]);
            }

            $changes = ['statut' => $data['statut']];
            if ($data['statut'] === MissionTask::STATUT_IN_PROGRESS && ! $locked->started_at) {
                $changes['started_at'] = now();
            }
            if ($data['statut'] === MissionTask::STATUT_DONE) {
                $changes['completed_at'] = now();
            }
            if ($data['statut'] === MissionTask::STATUT_REJECTED) {
                $changes['cancellation_reason'] = trim($data['motif']);
            }
            $locked->update($changes);
            $statusSync->syncOrdreMissionFromTask($locked);
        });

        return $this->task($request, $task->fresh());
    }

    public function updateTaskNotes(Request $request, MissionTask $task): JsonResponse
    {
        $data = $request->validate(['notes' => 'present|nullable|string|max:5000']);
        $this->assertOwnTask($request, $task);
        $task->update(['notes' => $data['notes']]);

        return $this->task($request, $task->fresh());
    }

    public function taskPvNumbers(Request $request, MissionTask $task): JsonResponse
    {
        $this->assertOwnTask($request, $task);

        return response()->json($this->pvNumbersPayload($task));
    }

    public function addTaskPvNumber(Request $request, MissionTask $task): JsonResponse
    {
        $data = $this->validatePvNumber($request);

        return DB::transaction(function () use ($request, $task, $data) {
            $locked = MissionTask::query()->lockForUpdate()->findOrFail($task->id);
            $this->assertOwnTask($request, $locked);
            $this->assertPvNumbersEditable($locked);
            $numbers = $locked->pv_numbers ?? [];
            $number = $data['pv_number'];
            if (! collect($numbers)->contains(fn (string $existing) => mb_strtolower($existing) === mb_strtolower($number))) {
                $numbers[] = $number;
                $locked->update(['pv_numbers' => $numbers]);
            }

            return response()->json($this->pvNumbersPayload($locked->fresh()));
        });
    }

    public function removeTaskPvNumber(Request $request, MissionTask $task): JsonResponse
    {
        $data = $this->validatePvNumber($request);

        return DB::transaction(function () use ($request, $task, $data) {
            $locked = MissionTask::query()->lockForUpdate()->findOrFail($task->id);
            $this->assertOwnTask($request, $locked);
            $this->assertPvNumbersEditable($locked);
            $numbers = array_values(array_filter($locked->pv_numbers ?? [],
                fn (string $existing) => mb_strtolower($existing) !== mb_strtolower($data['pv_number'])));
            $locked->update(['pv_numbers' => $numbers]);

            return response()->json($this->pvNumbersPayload($locked->fresh()));
        });
    }

    private function assertOwnTask(Request $request, MissionTask $task): void
    {
        abort_unless($this->ownTasks($request->user()->id)->whereKey($task->id)->exists(), 403);
    }

    private function validatePvNumber(Request $request): array
    {
        if (is_string($request->input('pv_number'))) {
            $request->merge(['pv_number' => trim($request->input('pv_number'))]);
        }

        return $request->validate([
            'pv_number' => ['required', 'string', 'max:100', 'not_regex:/[,;\r\n]/'],
        ]);
    }

    private function assertPvNumbersEditable(MissionTask $task): void
    {
        if ($task->reception_generated_at) {
            throw ValidationException::withMessages([
                'pv_number' => 'Les numéros de PV sont figés après la génération des étiquettes.',
            ]);
        }
    }

    private function pvNumbersPayload(MissionTask $task): array
    {
        $numbers = $task->pv_numbers ?? [];

        return ['pv_numbers' => $numbers, 'count' => count($numbers),
            'editable' => $task->reception_generated_at === null];
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

    public function storeStandaloneExpense(Request $request): JsonResponse
    {
        $data = $request->validate([
            'notes' => 'nullable|string|max:2000',
            'ordre_mission_id' => 'prohibited',
            'user_id' => 'prohibited',
        ]);
        $report = ExpenseReport::query()->create([
            'notes' => $data['notes'] ?? null,
            'ordre_mission_id' => null,
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

    public function uploadExpenseLinePhoto(Request $request, ExpenseReport $expenseReport, ExpenseLine $line): JsonResponse
    {
        $this->assertOwnExpenseLine($request, $expenseReport, $line);
        abort_unless($expenseReport->statut === ExpenseReport::STATUT_BROUILLON, 422);
        $data = $request->validate([
            'photo' => 'required|file|mimes:jpg,jpeg,png,webp|max:10240',
        ]);

        $path = $data['photo']->store("expense-receipts/{$expenseReport->id}/{$line->id}", 'local');
        $oldPath = $line->receipt_path;
        $line->update([
            'receipt_path' => $path,
            'receipt_filename' => $data['photo']->getClientOriginalName(),
        ]);
        if ($oldPath && $oldPath !== $path) {
            Storage::disk('local')->delete($oldPath);
        }

        return response()->json($line->fresh(), 200);
    }

    public function downloadExpenseLinePhoto(Request $request, ExpenseReport $expenseReport, ExpenseLine $line): StreamedResponse|JsonResponse
    {
        $this->assertOwnExpenseLine($request, $expenseReport, $line);
        if (! $line->receipt_path || ! Storage::disk('local')->exists($line->receipt_path)) {
            return response()->json(['message' => 'Photo absente'], 404);
        }

        return Storage::disk('local')->download($line->receipt_path, $line->receipt_filename ?? 'photo');
    }

    private function assertOwnExpenseLine(Request $request, ExpenseReport $expenseReport, ExpenseLine $line): void
    {
        abort_unless($expenseReport->user_id === $request->user()->id, 403);
        abort_unless($line->expense_report_id === $expenseReport->id && $line->user_id === $request->user()->id, 404);
    }

    private function ownTasks(int $userId): Builder
    {
        return MissionTask::query()->where('assigned_user_id', $userId)
            ->whereHas('ordreMissionLigne.ordreMission', fn (Builder $q) => $q
                ->whereIn('type', [OrdreMission::TYPE_TECHNICIEN, OrdreMission::TYPE_INGENIEUR, OrdreMission::TYPE_LABO]))
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
            'started_at' => $task->started_at?->toIso8601String(),
            'completed_at' => $task->completed_at?->toIso8601String(),
            'notes' => $task->notes,
            'pv_numbers' => $task->pv_numbers ?? [],
            'reception_generated_at' => $task->reception_generated_at?->toIso8601String(),
            'cancellation_reason' => $task->cancellation_reason,
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
