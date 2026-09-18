<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BonCommande;
use App\Models\MissionTask;
use App\Models\ModuleSetting;
use App\Models\RapportBC;
use App\Models\RapportBCVersion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;
use App\Models\RapportBCSuivi;
use App\Models\User;

class RapportBCController extends Controller
{
    // ── Helpers ──────────────────────────────────────────────────────────────

    private function canRead(Request $request): bool
    {
        return $request->user()?->isLab() ?? false;
    }

    private function canWrite(Request $request): bool
    {
        $user = $request->user();
        return $user && ($user->isLabAdmin() || $user->isLabManager());
    }

    private function canPublish(Request $request): bool
    {
        return $request->user()?->isLabAdmin() ?? false;
    }

    private function formatRapport(RapportBC $rapport): array
    {
        $rapport->loadMissing(['bonCommande:id,numero', 'createdBy:id,name', 'versions.uploadedByUser:id,name', 'taches']);

        return [
            'id'             => $rapport->id,
            'numero'         => $rapport->numero,
            'titre'          => $rapport->titre,
            'statut'         => $rapport->statut,
            'notes'          => $rapport->notes,
            'bon_commande_id' => $rapport->bon_commande_id,
            'bon_commande'   => $rapport->bonCommande ? [
                'id'     => $rapport->bonCommande->id,
                'numero' => $rapport->bonCommande->numero,
            ] : null,
            'created_by'     => $rapport->createdBy ? ['id' => $rapport->createdBy->id, 'name' => $rapport->createdBy->name] : null,
            'created_at'     => $rapport->created_at?->toIso8601String(),
            'updated_at'     => $rapport->updated_at?->toIso8601String(),
            'versions'       => $rapport->versions->map(fn (RapportBCVersion $v) => $this->formatVersion($v))->values(),
            'tache_ids'      => $rapport->taches->pluck('id')->all(),
        ];
    }

    private function formatVersion(RapportBCVersion $v): array
    {
        return [
            'id'                => $v->id,
            'version_number'    => $v->version_number,
            'original_filename' => $v->original_filename,
            'file_size'         => $v->file_size,
            'file_hash'         => $v->file_hash,
            'upload_notes'      => $v->upload_notes,
            'has_file'          => (bool) $v->file_path,
            'uploaded_by'       => $v->uploadedByUser ? ['id' => $v->uploadedByUser->id, 'name' => $v->uploadedByUser->name] : null,
            'created_at'        => $v->created_at?->toIso8601String(),
        ];
    }

    // ── Liste globale des rapports ────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        if (! $this->canRead($request)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $q      = trim((string) $request->get('q', ''));
        $statut = (string) $request->get('statut', '');

        $query = RapportBC::with([
            'bonCommande:id,numero',
            'createdBy:id,name',
            'versions' => fn ($q) => $q->orderByDesc('version_number')->limit(1),
        ])->withCount('taches');

        if ($q !== '') {
            $query->where(function ($sq) use ($q) {
                $sq->where('numero', 'like', "%{$q}%")
                   ->orWhere('titre', 'like', "%{$q}%");
            });
        }
        if ($statut !== '') {
            $query->where('statut', $statut);
        }

        $rows = $query->latest()->get()->map(function (RapportBC $r) {
            $latest = $r->versions->first();
            return [
                'id'              => $r->id,
                'numero'          => $r->numero,
                'titre'           => $r->titre,
                'statut'          => $r->statut,
                'bon_commande_id' => $r->bon_commande_id,
                'bon_commande'    => $r->bonCommande ? ['id' => $r->bonCommande->id, 'numero' => $r->bonCommande->numero] : null,
                'created_by'      => $r->createdBy ? ['id' => $r->createdBy->id, 'name' => $r->createdBy->name] : null,
                'taches_count'    => $r->taches_count ?? 0,
                'latest_version'  => $latest ? $this->formatVersion($latest) : null,
                'created_at'      => $r->created_at?->toIso8601String(),
                'updated_at'      => $r->updated_at?->toIso8601String(),
            ];
        });

        return response()->json($rows);
    }

    // ── Statuts config ───────────────────────────────────────────────────────

    public function statuts(): JsonResponse
    {
        return response()->json(RapportBC::getStatuts());
    }

    public function updateStatutsConfig(Request $request): JsonResponse
    {
        if (! $this->canPublish($request)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        $data = $request->validate([
            'statuts' => 'required|array|min:1',
            'statuts.*' => 'required|string|max:50',
        ]);
        $row = ModuleSetting::query()->firstOrNew(['module_key' => 'rapport_bc']);
        $row->settings = array_merge($row->settings ?? [], ['statuts' => $data['statuts']]);
        $row->save();
        return response()->json(RapportBC::getStatuts());
    }

    // ── Liste BCs avec leurs rapports ────────────────────────────────────────

    public function bcsWithRapports(Request $request): JsonResponse
    {
        if (! $this->canRead($request)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $bcs = BonCommande::query()
            ->select(['id', 'numero', 'statut', 'client_id', 'created_at'])
            ->with(['client:id,name'])
            ->withCount([
                'rapportBCs',
                'ordresMission as finished_tasks_count' => function ($q) {
                    $q->join('ordre_mission_lignes', 'ordre_mission_lignes.ordre_mission_id', '=', 'ordres_mission.id')
                      ->join('mission_tasks', 'mission_tasks.ordre_mission_ligne_id', '=', 'ordre_mission_lignes.id')
                      ->whereIn('mission_tasks.statut', [MissionTask::STATUT_DONE, MissionTask::STATUT_VALIDATED]);
                },
            ])
            ->orderByDesc('created_at')
            ->get();

        return response()->json($bcs);
    }

    // ── Tâches finalisées d'un BC ─────────────────────────────────────────────

    public function bcTaches(Request $request, BonCommande $bonCommande): JsonResponse
    {
        if (! $this->canRead($request)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $tasks = MissionTask::query()
            ->select([
                'mission_tasks.id',
                'mission_tasks.statut',
                'mission_tasks.created_at',
                'mission_tasks.updated_at',
                'mission_tasks.ordre_mission_ligne_id',
                'mission_tasks.assigned_user_id',
                'mission_tasks.planned_date',
                'mission_tasks.completed_at',
            ])
            ->join('ordre_mission_lignes', 'ordre_mission_lignes.id', '=', 'mission_tasks.ordre_mission_ligne_id')
            ->join('ordres_mission', 'ordres_mission.id', '=', 'ordre_mission_lignes.ordre_mission_id')
            ->where('ordres_mission.bon_commande_id', $bonCommande->id)
            ->with([
                'ordreMissionLigne:id,libelle,ordre_mission_id',
                'assignedUser:id,name',
            ])
            ->get();

        return response()->json($tasks->map(fn (MissionTask $t) => [
            'id'            => $t->id,
            'libelle'       => $t->ordreMissionLigne?->libelle,
            'statut'        => $t->statut,
            'planned_date'  => $t->planned_date,
            'completed_at'  => $t->completed_at?->toIso8601String(),
            'assigned_user' => $t->assignedUser ? ['id' => $t->assignedUser->id, 'name' => $t->assignedUser->name] : null,
            'created_at'    => $t->created_at?->toIso8601String(),
        ])->values());
    }

    // ── CRUD rapports ─────────────────────────────────────────────────────────

    public function indexByBc(Request $request, BonCommande $bonCommande): JsonResponse
    {
        if (! $this->canRead($request)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $rapports = RapportBC::query()
            ->where('bon_commande_id', $bonCommande->id)
            ->with(['createdBy:id,name', 'versions' => fn ($q) => $q->orderByDesc('version_number')->limit(1)])
            ->withCount('taches')
            ->orderByDesc('created_at')
            ->get();

        return response()->json($rapports->map(fn (RapportBC $r) => [
            'id'              => $r->id,
            'numero'          => $r->numero,
            'titre'           => $r->titre,
            'statut'          => $r->statut,
            'taches_count'    => $r->taches_count,
            'created_by'      => $r->createdBy ? ['id' => $r->createdBy->id, 'name' => $r->createdBy->name] : null,
            'latest_version'  => $r->versions->first() ? $this->formatVersion($r->versions->first()) : null,
            'created_at'      => $r->created_at?->toIso8601String(),
        ])->values());
    }

    public function store(Request $request, BonCommande $bonCommande): JsonResponse
    {
        if (! $this->canWrite($request)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $data = $request->validate([
            'titre'      => 'nullable|string|max:255',
            'statut'     => 'nullable|string|max:50',
            'notes'      => 'nullable|string',
            'tache_ids'  => 'nullable|array',
            'tache_ids.*' => 'integer',
        ]);

        $rapport = DB::transaction(function () use ($bonCommande, $data, $request) {
            $rapport = RapportBC::query()->create([
                'numero'          => RapportBC::nextNumero(),
                'titre'           => $data['titre'] ?? null,
                'statut'          => $data['statut'] ?? RapportBC::STATUT_BROUILLON,
                'bon_commande_id' => $bonCommande->id,
                'created_by'      => $request->user()->id,
                'notes'           => $data['notes'] ?? null,
            ]);

            if (! empty($data['tache_ids'])) {
                $rapport->taches()->sync($data['tache_ids']);
            }

            return $rapport;
        });

        return response()->json($this->formatRapport($rapport->fresh()), 201);
    }

    public function show(Request $request, RapportBC $rapportBC): JsonResponse
    {
        if (! $this->canRead($request)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        return response()->json($this->formatRapport($rapportBC));
    }

    public function update(Request $request, RapportBC $rapportBC): JsonResponse
    {
        if (! $this->canWrite($request)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        // Only lab_admin can publish (set to valide/archive)
        $newStatut = $request->input('statut');
        if ($newStatut && in_array($newStatut, [RapportBC::STATUT_VALIDE, RapportBC::STATUT_ARCHIVE], true)) {
            if (! $this->canPublish($request)) {
                return response()->json(['message' => 'Seul un administrateur peut valider ou archiver un rapport.'], 403);
            }
        }

        $data = $request->validate([
            'titre'      => 'sometimes|nullable|string|max:255',
            'statut'     => 'sometimes|nullable|string|max:50',
            'notes'      => 'sometimes|nullable|string',
            'tache_ids'  => 'sometimes|nullable|array',
            'tache_ids.*' => 'integer',
        ]);

        $statutFrom = $rapportBC->statut;

        DB::transaction(function () use ($rapportBC, $data) {
            $rapportBC->update(array_filter([
                'titre'  => $data['titre'] ?? $rapportBC->titre,
                'statut' => $data['statut'] ?? $rapportBC->statut,
                'notes'  => array_key_exists('notes', $data) ? $data['notes'] : $rapportBC->notes,
            ], fn ($v) => $v !== null));

            if (array_key_exists('tache_ids', $data)) {
                $rapportBC->taches()->sync($data['tache_ids'] ?? []);
            }
        });

        if (isset($data['statut']) && $data['statut'] !== $statutFrom) {
            $rapportBC->suivis()->create([
                'user_id'     => $request->user()?->id,
                'type'        => 'statut_change',
                'message'     => "Statut changé de « {$statutFrom} » vers « {$data['statut']} »",
                'statut_from' => $statutFrom,
                'statut_to'   => $data['statut'],
            ]);
        }

        return response()->json($this->formatRapport($rapportBC->fresh()));
    }

    public function destroy(Request $request, RapportBC $rapportBC): JsonResponse
    {
        if (! $this->canPublish($request)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        foreach ($rapportBC->versions as $version) {
            if ($version->file_path) {
                Storage::disk('local')->delete($version->file_path);
            }
        }
        $rapportBC->delete();

        return response()->json(null, 204);
    }

    // ── Suivis ────────────────────────────────────────────────────────────────

    public function listSuivis(RapportBC $rapportBC, Request $request): JsonResponse
    {
        if (! $this->canRead($request)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        $suivis = $rapportBC->suivis()->with('user:id,name')->get()->map(fn (RapportBCSuivi $s) => [
            'id'          => $s->id,
            'type'        => $s->type,
            'message'     => $s->message,
            'statut_from' => $s->statut_from,
            'statut_to'   => $s->statut_to,
            'user'        => $s->user ? ['id' => $s->user->id, 'name' => $s->user->name] : null,
            'created_at'  => $s->created_at?->toIso8601String(),
        ]);
        return response()->json($suivis);
    }

    public function addSuivi(RapportBC $rapportBC, Request $request): JsonResponse
    {
        if (! $this->canRead($request)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        $data = $request->validate(['message' => 'required|string|max:2000']);
        $suivi = $rapportBC->suivis()->create([
            'user_id' => $request->user()?->id,
            'type'    => 'note',
            'message' => $data['message'],
        ]);
        $suivi->load('user:id,name');
        return response()->json([
            'id'          => $suivi->id,
            'type'        => $suivi->type,
            'message'     => $suivi->message,
            'statut_from' => null,
            'statut_to'   => null,
            'user'        => $suivi->user ? ['id' => $suivi->user->id, 'name' => $suivi->user->name] : null,
            'created_at'  => $suivi->created_at?->toIso8601String(),
        ], 201);
    }

    public function requestValidation(RapportBC $rapportBC, Request $request): JsonResponse
    {
        if (! $this->canRead($request)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        $data = $request->validate(['validator_id' => 'nullable|exists:users,id', 'message' => 'nullable|string|max:500']);
        $from = $rapportBC->statut;
        $rapportBC->update(['statut' => 'preliminaire']);

        $validatorName = $data['validator_id']
            ? optional(User::find($data['validator_id']))->name
            : null;

        $rapportBC->suivis()->create([
            'user_id'     => $request->user()?->id,
            'type'        => 'validation',
            'message'     => 'Demande de validation' . ($validatorName ? " auprès de {$validatorName}" : '') . ($data['message'] ? " — {$data['message']}" : ''),
            'statut_from' => $from,
            'statut_to'   => 'preliminaire',
        ]);

        return response()->json($this->formatRapport($rapportBC->fresh()));
    }

    // ── Versions (upload fichier) ─────────────────────────────────────────────

    public function uploadVersion(Request $request, RapportBC $rapportBC): JsonResponse
    {
        if (! $this->canWrite($request)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $request->validate([
            'file'         => 'required|file|max:51200',
            'upload_notes' => 'nullable|string|max:500',
        ]);

        $file = $request->file('file');
        $hash = md5_file($file->getRealPath());

        $lastVersion = $rapportBC->versions()->orderByDesc('version_number')->first();
        $versionNumber = $lastVersion ? $lastVersion->version_number + 1 : 1;

        $path = $file->store("rapport-bc/{$rapportBC->id}", 'local');

        $version = RapportBCVersion::query()->create([
            'rapport_bc_id'     => $rapportBC->id,
            'version_number'    => $versionNumber,
            'file_path'         => $path,
            'original_filename' => $file->getClientOriginalName(),
            'file_hash'         => $hash,
            'file_size'         => $file->getSize(),
            'uploaded_by'       => $request->user()->id,
            'upload_notes'      => $request->input('upload_notes'),
            'created_at'        => now(),
        ]);

        $rapportBC->touch();

        return response()->json($this->formatVersion($version->load('uploadedByUser')), 201);
    }

    public function downloadVersion(Request $request, RapportBC $rapportBC, RapportBCVersion $version): StreamedResponse|JsonResponse
    {
        if (! $this->canRead($request)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        if (! $version->file_path || ! Storage::disk('local')->exists($version->file_path)) {
            return response()->json(['message' => 'Fichier introuvable'], 404);
        }

        return Storage::disk('local')->download($version->file_path, $version->original_filename ?? 'rapport.pdf');
    }

    public function destroyVersion(Request $request, RapportBC $rapportBC, RapportBCVersion $version): JsonResponse
    {
        if (! $this->canPublish($request)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        if ($version->file_path) {
            Storage::disk('local')->delete($version->file_path);
        }
        $version->delete();

        return response()->json($this->formatRapport($rapportBC->fresh()));
    }

    // ── Récapitulatif ─────────────────────────────────────────────────────────

    public function recap(Request $request, RapportBC $rapportBC): JsonResponse
    {
        if (! $this->canRead($request)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $rapportBC->loadMissing([
            'bonCommande:id,numero,client_id',
            'bonCommande.client:id,name',
            'createdBy:id,name',
            'versions.uploadedByUser:id,name',
            'taches.ordreMissionLigne:id,libelle,ordre_mission_id',
            'taches.assignedUser:id,name',
        ]);

        $allBcTaches = MissionTask::query()
            ->join('ordre_mission_lignes', 'ordre_mission_lignes.id', '=', 'mission_tasks.ordre_mission_ligne_id')
            ->join('ordres_mission', 'ordres_mission.id', '=', 'ordre_mission_lignes.ordre_mission_id')
            ->where('ordres_mission.bon_commande_id', $rapportBC->bon_commande_id)
            ->selectRaw('mission_tasks.statut, COUNT(*) as total')
            ->groupBy('mission_tasks.statut')
            ->pluck('total', 'statut')
            ->all();

        return response()->json([
            'rapport'     => $this->formatRapport($rapportBC),
            'bc_statuts'  => $allBcTaches,
            'taches'      => $rapportBC->taches->map(fn (MissionTask $t) => [
                'id'            => $t->id,
                'libelle'       => $t->ordreMissionLigne?->libelle,
                'statut'        => $t->statut,
                'assigned_user' => $t->assignedUser ? ['id' => $t->assignedUser->id, 'name' => $t->assignedUser->name] : null,
                'planned_date'  => $t->planned_date,
                'completed_at'  => $t->completed_at?->toIso8601String(),
                'created_at'    => $t->created_at?->toIso8601String(),
            ])->values(),
        ]);
    }
}
