<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PlanningEquipment;
use App\Models\PlanningHuman;
use App\Models\StockEquipment;
use App\Models\StockPersonnel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlanningController extends Controller
{
    // ── Planning humain ──────────────────────────────────────────────────────

    /** GET /planning/humans?from=&to=&user_id= */
    public function humansIndex(Request $request): JsonResponse
    {
        $q = PlanningHuman::query()->with(['user:id,name,email', 'missionTask:id,statut']);

        if ($from = $request->string('from')) {
            $q->where('date_fin', '>=', $from);
        }
        if ($to = $request->string('to')) {
            $q->where('date_debut', '<=', $to);
        }
        if ($uid = $request->integer('user_id')) {
            $q->where('user_id', $uid);
        }

        return response()->json($q->orderBy('date_debut')->get());
    }

    /** POST /planning/humans */
    public function humansStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'user_id'          => 'required|exists:users,id',
            'mission_task_id'  => 'nullable|exists:mission_tasks,id',
            'date_debut'       => 'required|date',
            'date_fin'         => 'required|date|after_or_equal:date_debut',
            'heure_debut'      => 'nullable|date_format:H:i',
            'heure_fin'        => 'nullable|date_format:H:i',
            'type_evenement'   => 'in:tache,conge,formation,absent,autre',
            'notes'            => 'nullable|string|max:512',
        ]);

        $slot = PlanningHuman::create($data);
        return response()->json($slot->load(['user:id,name', 'missionTask:id,statut']), 201);
    }

    /** DELETE /planning/humans/{id} */
    public function humansDestroy(int $id): JsonResponse
    {
        PlanningHuman::findOrFail($id)->delete();
        return response()->json(null, 204);
    }

    // ── Planning matériel ────────────────────────────────────────────────────

    /** GET /planning/equipments?from=&to=&equipment_id= */
    public function equipmentsIndex(Request $request): JsonResponse
    {
        $q = PlanningEquipment::query()->with(['equipment:id,name,code', 'missionTask:id,statut']);

        if ($from = $request->string('from')) {
            $q->where('date_fin', '>=', $from);
        }
        if ($to = $request->string('to')) {
            $q->where('date_debut', '<=', $to);
        }
        if ($eid = $request->integer('equipment_id')) {
            $q->where('equipment_id', $eid);
        }

        return response()->json($q->orderBy('date_debut')->get());
    }

    /** POST /planning/equipments */
    public function equipmentsStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'equipment_id'    => 'required|exists:equipments,id',
            'mission_task_id' => 'nullable|exists:mission_tasks,id',
            'date_debut'      => 'required|date',
            'date_fin'        => 'required|date|after_or_equal:date_debut',
            'type_evenement'  => 'in:utilisation,maintenance,indispo,autre',
            'notes'           => 'nullable|string|max:512',
        ]);

        $slot = PlanningEquipment::create($data);
        return response()->json($slot->load(['equipment:id,name,code', 'missionTask:id,statut']), 201);
    }

    /** DELETE /planning/equipments/{id} */
    public function equipmentsDestroy(int $id): JsonResponse
    {
        PlanningEquipment::findOrFail($id)->delete();
        return response()->json(null, 204);
    }

    // ── Stock personnel ──────────────────────────────────────────────────────

    /** GET /planning/stock/personnel?from=&to= */
    public function stockPersonnelIndex(Request $request): JsonResponse
    {
        $q = StockPersonnel::query()->with('user:id,name,email');

        if ($from = $request->string('from')) {
            $q->where('date_fin', '>=', $from);
        }
        if ($to = $request->string('to')) {
            $q->where('date_debut', '<=', $to);
        }
        if ($uid = $request->integer('user_id')) {
            $q->where('user_id', $uid);
        }

        return response()->json($q->orderBy('date_debut')->get());
    }

    /** POST /planning/stock/personnel */
    public function stockPersonnelStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'user_id'      => 'required|exists:users,id',
            'date_debut'   => 'required|date',
            'date_fin'     => 'required|date|after_or_equal:date_debut',
            'motif'        => 'in:conge,maladie,formation,autre',
            'is_validated' => 'boolean',
            'notes'        => 'nullable|string|max:512',
        ]);

        $stock = StockPersonnel::create($data);
        return response()->json($stock->load('user:id,name'), 201);
    }

    /** DELETE /planning/stock/personnel/{id} */
    public function stockPersonnelDestroy(int $id): JsonResponse
    {
        StockPersonnel::findOrFail($id)->delete();
        return response()->json(null, 204);
    }

    // ── Stock matériel ───────────────────────────────────────────────────────

    /** GET /planning/stock/equipment?from=&to= */
    public function stockEquipmentIndex(Request $request): JsonResponse
    {
        $q = StockEquipment::query()->with('equipment:id,name,code');

        if ($from = $request->string('from')) {
            $q->where('date_fin', '>=', $from);
        }
        if ($to = $request->string('to')) {
            $q->where('date_debut', '<=', $to);
        }
        if ($eid = $request->integer('equipment_id')) {
            $q->where('equipment_id', $eid);
        }

        return response()->json($q->orderBy('date_debut')->get());
    }

    /** POST /planning/stock/equipment */
    public function stockEquipmentStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'equipment_id' => 'required|exists:equipments,id',
            'date_debut'   => 'required|date',
            'date_fin'     => 'required|date|after_or_equal:date_debut',
            'motif'        => 'in:maintenance,panne,calibration,autre',
            'is_validated' => 'boolean',
            'notes'        => 'nullable|string|max:512',
        ]);

        $stock = StockEquipment::create($data);
        return response()->json($stock->load('equipment:id,name,code'), 201);
    }

    /** DELETE /planning/stock/equipment/{id} */
    public function stockEquipmentDestroy(int $id): JsonResponse
    {
        StockEquipment::findOrFail($id)->delete();
        return response()->json(null, 204);
    }

    /**
     * GET /planning/overview?from=&to=
     * Vue unifiée : tous les slots humains + machines + indispos sur une plage.
     */
    public function overview(Request $request): JsonResponse
    {
        $from = $request->string('from') ?: now()->startOfMonth()->toDateString();
        $to   = $request->string('to')   ?: now()->endOfMonth()->toDateString();

        return response()->json([
            'humans' => PlanningHuman::query()
                ->whereBetween('date_debut', [$from, $to])
                ->orWhereBetween('date_fin', [$from, $to])
                ->with(['user:id,name', 'missionTask:id,statut'])
                ->get(),
            'equipments' => PlanningEquipment::query()
                ->whereBetween('date_debut', [$from, $to])
                ->orWhereBetween('date_fin', [$from, $to])
                ->with(['equipment:id,name,code', 'missionTask:id,statut'])
                ->get(),
            'stock_personnels' => StockPersonnel::query()
                ->where('date_fin', '>=', $from)
                ->where('date_debut', '<=', $to)
                ->with('user:id,name')
                ->get(),
            'stock_equipments' => StockEquipment::query()
                ->where('date_fin', '>=', $from)
                ->where('date_debut', '<=', $to)
                ->with('equipment:id,name,code')
                ->get(),
        ]);
    }
}
