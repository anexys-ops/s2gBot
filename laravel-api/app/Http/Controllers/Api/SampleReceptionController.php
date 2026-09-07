<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BonCommandeLigne;
use App\Models\OrderItem;
use App\Models\Sample;
use App\Models\Sequence;
use App\Models\User;
use App\Services\LabReceptionService;
use App\Services\SampleLabelPayloadBuilder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * v1.2.0 — Menu RÉCEPTION : gestion des échantillons.
 *
 * Flux : terrain crée (en_transit) → réception (receptionne) →
 * labo (en_essai) → terminé / rejeté.
 */
class SampleReceptionController extends Controller
{
    private const REL = [
        'dossier:id,reference,titre',
        'missionOrder:id,unique_number,numero,type',
        'task:id,unique_number,statut',
        'product:id,libelle,code',
        'bonCommandeLigne:id,libelle,bon_commande_id',
        'bonCommandeLigne.bonCommande:id,numero,quote_id',
        'collectedBy:id,name,role',
        'receivedBy:id,name,role',
    ];

    public function __construct(
        private readonly LabReceptionService $receptionService,
        private readonly SampleLabelPayloadBuilder $labelBuilder,
    ) {}

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
        if ($lineId = $request->integer('bon_commande_ligne_id')) {
            $q->where('bon_commande_ligne_id', $lineId);
        }
        if ($fold = trim((string) $request->query('fold', ''))) {
            $q->where(function ($inner) use ($fold) {
                $inner->where('fold_number', 'like', "%{$fold}%")
                    ->orWhere('transco_number', 'like', "%{$fold}%");
            });
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

        $data['status'] = $data['status'] ?? Sample::STATUS_EN_TRANSIT;
        $data['collected_by'] = $data['collected_by'] ?? ($user instanceof User ? $user->id : null);
        $data['collected_at'] = $data['collected_at'] ?? now();

        if (empty($data['reference']) && Schema::hasColumn('samples', 'reference')) {
            $data['reference'] = 'SMP-'.now()->format('Ymd-His').'-'.random_int(100, 999);
        }

        $sample = Sample::create($data);

        return response()->json($sample->load(self::REL), 201);
    }

    /**
     * Réception labo depuis une ligne BC (produit attendu) : création + réception en une étape.
     */
    public function receiveFromLine(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'bon_commande_ligne_id' => ['required', 'integer', 'exists:bons_commande_lignes,id'],
            'condition_state' => ['required', Rule::in(Sample::CONDITIONS)],
            'storage_location' => ['nullable', 'string', 'max:191'],
            'collected_by' => ['nullable', 'integer', 'exists:users,id'],
            'sample_type' => ['nullable', Rule::in(Sample::TYPES)],
            'origin_location' => ['nullable', 'string', 'max:255'],
            'depth_m' => ['nullable', 'numeric'],
            'weight_g' => ['nullable', 'numeric', 'min:0'],
            'quantity' => ['nullable', 'integer', 'min:1'],
            'notes' => ['nullable', 'string'],
            'description' => ['nullable', 'string'],
        ]);

        /** @var BonCommandeLigne $ligne */
        $ligne = BonCommandeLigne::query()
            ->with(['bonCommande.dossier', 'article'])
            ->findOrFail($data['bon_commande_ligne_id']);

        if (! $this->receptionService->isLineEligible($ligne)) {
            return response()->json(['message' => 'Cette ligne BC n\'est pas éligible à la réception labo.'], 422);
        }

        $bc = $ligne->bonCommande;
        $createData = [
            'bon_commande_ligne_id' => $ligne->id,
            'dossier_id' => $bc?->dossier_id,
            'product_id' => $ligne->ref_article_id,
            'description' => $data['description'] ?? $ligne->libelle,
            'sample_type' => $data['sample_type'] ?? 'sol',
            'origin_location' => $data['origin_location'] ?? null,
            'depth_m' => $data['depth_m'] ?? null,
            'collected_by' => $data['collected_by'] ?? $ligne->technicien_id,
            'collected_at' => now(),
            'reference' => 'SMP-'.now()->format('Ymd-His').'-'.random_int(100, 999),
            'status' => Sample::STATUS_EN_TRANSIT,
        ];

        if (Schema::hasColumn('samples', 'order_item_id')
            && Schema::getConnection()->getDriverName() === 'sqlite') {
            $fallback = OrderItem::query()->value('id');
            if ($fallback !== null) {
                $createData['order_item_id'] = $fallback;
            }
        }

        $sample = Sample::create($createData);

        $this->finalizeReception($sample, $user, $data);

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
            'condition_state' => ['required', Rule::in(Sample::CONDITIONS)],
            'storage_location' => ['nullable', 'string', 'max:191'],
            'collected_by' => ['nullable', 'integer', 'exists:users,id'],
            'photo_path' => ['nullable', 'string', 'max:512'],
            'weight_g' => ['nullable', 'numeric', 'min:0'],
            'quantity' => ['nullable', 'integer', 'min:1'],
            'notes' => ['nullable', 'string'],
        ]);

        if (isset($data['collected_by'])) {
            $sample->collected_by = $data['collected_by'];
            unset($data['collected_by']);
        }

        $this->finalizeReception($sample, $user, $data);

        return response()->json($sample->load(self::REL));
    }

    public function uploadPhoto(Request $request, Sample $sample): JsonResponse
    {
        $request->validate([
            'photo' => ['required', 'image', 'max:8192'],
        ]);

        if ($sample->photo_path && Storage::disk('local')->exists($sample->photo_path)) {
            Storage::disk('local')->delete($sample->photo_path);
        }

        $path = $request->file('photo')->store('samples/photos', 'local');
        $sample->update(['photo_path' => $path]);

        return response()->json([
            'photo_path' => $path,
            'photo_url' => url("/api/v1/samples/{$sample->id}/photo"),
        ]);
    }

    public function downloadPhoto(Sample $sample): StreamedResponse|JsonResponse
    {
        if (! $sample->photo_path || ! Storage::disk('local')->exists($sample->photo_path)) {
            return response()->json(['message' => 'Photo absente'], 404);
        }

        return Storage::disk('local')->download($sample->photo_path);
    }

    public function labelData(Sample $sample): JsonResponse
    {
        if (! $sample->transco_number) {
            return response()->json(['message' => 'Échantillon non réceptionné — pas d\'étiquette transco.'], 422);
        }

        return response()->json($this->labelBuilder->build($sample->load(self::REL)));
    }

    public function destroy(Sample $sample): JsonResponse
    {
        if (! in_array($sample->status, [Sample::STATUS_EN_TRANSIT, Sample::STATUS_RECEPTIONNE], true)) {
            return response()->json(['message' => 'Seuls les échantillons en transit ou réceptionnés peuvent être supprimés.'], 422);
        }

        if ($sample->photo_path && Storage::disk('local')->exists($sample->photo_path)) {
            Storage::disk('local')->delete($sample->photo_path);
        }

        $sample->delete();

        return response()->json(null, 204);
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
            ->where(function ($q) use ($fold) {
                $q->where('fold_number', 'like', "%{$fold}%")
                    ->orWhere('transco_number', 'like', "%{$fold}%");
            })
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
            'en_transit' => $by(Sample::STATUS_EN_TRANSIT),
            'receptionne' => $by(Sample::STATUS_RECEPTIONNE),
            'en_essai' => $by(Sample::STATUS_EN_ESSAI),
            'termine' => $by(Sample::STATUS_TERMINE),
            'rejete' => $by(Sample::STATUS_REJETE),
            'receptionnes_today' => Sample::query()
                ->where('status', Sample::STATUS_RECEPTIONNE)
                ->whereDate('received_at', today())
                ->count(),
        ]);
    }

    /** @param  array<string, mixed>  $data */
    private function finalizeReception(Sample $sample, mixed $user, array $data): void
    {
        $sample->fill($data);
        $sample->status = Sample::STATUS_RECEPTIONNE;
        $sample->received_by = $user instanceof User ? $user->id : null;
        $sample->received_at = now();

        if (empty($sample->transco_number) && Schema::hasColumn('samples', 'transco_number')) {
            $sample->transco_number = Sequence::nextNumeric('TRANSCO');
        }

        $sample->save();
    }

    /** @return array<string, mixed> */
    private function validateForCreate(Request $request, bool $partial = false): array
    {
        $req = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'dossier_id' => ['nullable', 'integer', 'exists:dossiers,id'],
            'mission_order_id' => ['nullable', 'integer', 'exists:ordres_mission,id'],
            'task_id' => ['nullable', 'integer', 'exists:mission_tasks,id'],
            'product_id' => ['nullable', 'integer', 'exists:ref_articles,id'],
            'bon_commande_ligne_id' => ['nullable', 'integer', 'exists:bons_commande_lignes,id'],
            'reference' => ['nullable', 'string', 'max:191'],
            'description' => ['nullable', 'string'],
            'sample_type' => [$req, Rule::in(Sample::TYPES)],
            'origin_location' => ['nullable', 'string', 'max:255'],
            'depth_m' => ['nullable', 'numeric'],
            'collected_by' => ['nullable', 'integer', 'exists:users,id'],
            'collected_at' => ['nullable', 'date'],
            'status' => ['nullable', Rule::in(Sample::STATUSES_RECEPTION)],
            'condition_state' => ['nullable', Rule::in(Sample::CONDITIONS)],
            'storage_location' => ['nullable', 'string', 'max:191'],
            'photo_path' => ['nullable', 'string', 'max:512'],
            'weight_g' => ['nullable', 'numeric', 'min:0'],
            'quantity' => ['nullable', 'integer', 'min:1'],
            'notes' => ['nullable', 'string'],
        ]);
    }
}
