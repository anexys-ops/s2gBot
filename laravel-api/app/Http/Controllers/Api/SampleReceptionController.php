<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Sample;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;

/**
 * v1.2.0 — Menu RÉCEPTION : gestion des échantillons.
 *
 * Flux : terrain crée (en_transit) → réception (receptionne) →
 * labo (en_essai) → terminé / rejeté.
 *
 * Distinct du SampleController historique (qui s'appuie sur OrderItem/AgencyAccess).
 */
class SampleReceptionController extends Controller
{
    private const REL = [
        'dossier:id,reference,titre',
        'missionOrder:id,unique_number,numero,type',
        'task:id,unique_number,statut',
        'product:id,libelle,code',
        'collectedBy:id,name,role',
        'receivedBy:id,name,role',
    ];

    public function index(Request $request): JsonResponse
    {
        $q = Sample::query()->with(self::REL);

        if ($s = trim((string) $request->query('status', ''))) {
            $q->where('status', $s);
        }
        if ($d = $request->integer('dossier_id')) {
            $q->where('dossier_id', $d);
        }
        if ($m = $request->integer('mission_order_id')) {
            $q->where('mission_order_id', $m);
        }
        if ($fold = trim((string) $request->query('fold', ''))) {
            $q->where('fold_number', 'like', "%{$fold}%");
        }
        if ($from = $request->query('from')) {
            $q->where('collected_at', '>=', $from);
        }
        if ($to = $request->query('to')) {
            $q->where('collected_at', '<=', $to);
        }

        $perPage = min(max((int) $request->query('per_page', 50), 1), 200);
        return response()->json($q->orderByDesc('id')->paginate($perPage));
    }

    public function show(Sample $sample): JsonResponse
    {
        return response()->json($sample->load(self::REL));
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $this->validateForCreate($request);

        $data['status']        = $data['status']        ?? Sample::STATUS_EN_TRANSIT;
        $data['collected_by']  = $data['collected_by']  ?? ($user instanceof User ? $user->id : null);
        $data['collected_at']  = $data['collected_at']  ?? now();

        if (empty($data['reference']) && Schema::hasColumn('samples', 'reference')) {
            $data['reference'] = 'SMP-'.now()->format('Ymd-His').'-'.random_int(100, 999);
        }

        $sample = Sample::create($data);
        return response()->json($sample->load(self::REL), 201);
    }

    public function update(Request $request, Sample $sample): JsonResponse
    {
        $data = $this->validateForCreate($request, partial: true);
        $sample->fill($data)->save();
        return response()->json($sample->load(self::REL));
    }

    public function receive(Request $request, Sample $sample): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'condition_state'  => ['required', Rule::in(Sample::CONDITIONS)],
            'storage_location' => ['nullable', 'string', 'max:191'],
            'photo_path'       => ['nullable', 'string', 'max:512'],
            'weight_g'         => ['nullable', 'numeric', 'min:0'],
            'quantity'         => ['nullable', 'integer', 'min:1'],
            'notes'            => ['nullable', 'string'],
        ]);

        $sample->fill($data);
        $sample->status      = Sample::STATUS_RECEPTIONNE;
        $sample->received_by = $user instanceof User ? $user->id : null;
        $sample->received_at = now();
        $sample->save();

        return response()->json($sample->load(self::REL));
    }

    public function startTest(Sample $sample): JsonResponse
    {
        $sample->update(['status' => Sample::STATUS_EN_ESSAI]);
        return response()->json($sample->load(self::REL));
    }

    public function complete(Sample $sample): JsonResponse
    {
        $sample->update(['status' => Sample::STATUS_TERMINE]);
        return response()->json($sample->load(self::REL));
    }

    public function reject(Request $request, Sample $sample): JsonResponse
    {
        $data = $request->validate([
            'rejection_reason' => ['required', 'string', 'max:1000'],
        ]);
        $sample->fill($data);
        $sample->status = Sample::STATUS_REJETE;
        $sample->save();
        return response()->json($sample->load(self::REL));
    }

    public function searchByFold(Request $request): JsonResponse
    {
        $fold = trim((string) $request->query('fold', ''));
        if (strlen($fold) < 3) {
            return response()->json(['data' => []]);
        }
        $samples = Sample::query()
            ->where('fold_number', 'like', "%{$fold}%")
            ->with(self::REL)
            ->orderByDesc('id')
            ->limit(20)
            ->get();
        return response()->json(['data' => $samples]);
    }

    public function stats(): JsonResponse
    {
        $by = fn (string $status): int => Sample::query()->where('status', $status)->count();

        return response()->json([
            'en_transit'         => $by(Sample::STATUS_EN_TRANSIT),
            'receptionne'        => $by(Sample::STATUS_RECEPTIONNE),
            'en_essai'           => $by(Sample::STATUS_EN_ESSAI),
            'termine'            => $by(Sample::STATUS_TERMINE),
            'rejete'             => $by(Sample::STATUS_REJETE),
            'receptionnes_today' => Sample::query()
                ->where('status', Sample::STATUS_RECEPTIONNE)
                ->whereDate('received_at', today())
                ->count(),
        ]);
    }

    /** @return array<string, mixed> */
    private function validateForCreate(Request $request, bool $partial = false): array
    {
        $req = $partial ? 'sometimes' : 'required';
        return $request->validate([
            'dossier_id'        => ['nullable', 'integer', 'exists:dossiers,id'],
            'mission_order_id'  => ['nullable', 'integer', 'exists:ordres_mission,id'],
            'task_id'           => ['nullable', 'integer', 'exists:mission_tasks,id'],
            'product_id'        => ['nullable', 'integer', 'exists:ref_articles,id'],
            'reference'         => ['nullable', 'string', 'max:191'],
            'description'       => ['nullable', 'string'],
            'sample_type'       => [$req, Rule::in(Sample::TYPES)],
            'origin_location'   => ['nullable', 'string', 'max:255'],
            'depth_m'           => ['nullable', 'numeric'],
            'collected_by'      => ['nullable', 'integer', 'exists:users,id'],
            'collected_at'      => ['nullable', 'date'],
            'status'            => ['nullable', Rule::in(Sample::STATUSES_RECEPTION)],
            'condition_state'   => ['nullable', Rule::in(Sample::CONDITIONS)],
            'storage_location'  => ['nullable', 'string', 'max:191'],
            'photo_path'        => ['nullable', 'string', 'max:512'],
            'weight_g'          => ['nullable', 'numeric', 'min:0'],
            'quantity'          => ['nullable', 'integer', 'min:1'],
            'notes'             => ['nullable', 'string'],
        ]);
    }
}
