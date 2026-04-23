<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\BcLignePlanningAffectation;
use App\Models\BonCommandeLigne;
use App\Models\User;
use App\Support\AgencyAccess;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class PlanningTerrainController extends Controller
{
    public function techniciens(Request $request): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $users = User::query()
            ->whereIn('role', [User::ROLE_LAB_ADMIN, User::ROLE_LAB_TECHNICIAN])
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'role']);

        return response()->json($users);
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->isLab() && ! $user->client_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'from' => 'required|date',
            'to' => 'required|date|after_or_equal:from',
            'user_id' => 'sometimes|nullable|integer|exists:users,id',
        ]);

        $from = $validated['from'];
        $to = $validated['to'];

        $q = BcLignePlanningAffectation::query()
            ->with([
                'bonCommandeLigne.bonCommande.dossier.site',
                'bonCommandeLigne.bonCommande.client',
                'user',
                'createur',
            ])
            ->where(function (Builder $b) use ($from, $to) {
                $b->where('date_debut', '<=', $to)
                    ->where('date_fin', '>=', $from);
            });

        if (! empty($validated['user_id'])) {
            $q->where('user_id', (int) $validated['user_id']);
        }

        if (! $user->isLab()) {
            $q->whereHas('bonCommandeLigne.bonCommande.dossier', function (Builder $dossierQ) use ($user) {
                AgencyAccess::applyDossierScope($dossierQ, $user);
            });
        }

        $rows = $q->orderBy('date_debut')->orderBy('id')->get();

        return response()->json($rows);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $data = $request->validate([
            'bon_commande_ligne_id' => 'required|integer|exists:bons_commande_lignes,id',
            'user_id' => ['required', 'integer', 'exists:users,id', function ($attribute, $value, $fail) {
                $u = User::query()->find((int) $value);
                if (! $u || ! $u->isLab()) {
                    $fail('Le technicien doit être un utilisateur lab.');
                }
            }],
            'date_debut' => 'required|date',
            'date_fin' => 'required|date|after_or_equal:date_debut',
            'notes' => 'nullable|string',
        ]);

        $ligne = BonCommandeLigne::query()->with('bonCommande')->findOrFail($data['bon_commande_ligne_id']);
        if (! AgencyAccess::userMayAccessBonCommande($request->user(), $ligne->bonCommande)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $this->assertAssignmentWithinLigneWindow($ligne, $data['date_debut'], $data['date_fin']);

        $row = BcLignePlanningAffectation::query()->create([
            'bon_commande_ligne_id' => $ligne->id,
            'user_id' => (int) $data['user_id'],
            'date_debut' => $data['date_debut'],
            'date_fin' => $data['date_fin'],
            'notes' => $data['notes'] ?? null,
            'created_by' => $request->user()->id,
        ]);

        return response()->json($row->load([
            'bonCommandeLigne.bonCommande.dossier',
            'bonCommandeLigne.bonCommande.client',
            'user',
        ]), 201);
    }

    public function update(Request $request, BcLignePlanningAffectation $bcLignePlanningAffectation): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $bcLignePlanningAffectation->load('bonCommandeLigne.bonCommande');
        if (! AgencyAccess::userMayAccessBonCommande($request->user(), $bcLignePlanningAffectation->bonCommandeLigne->bonCommande)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $data = $request->validate([
            'user_id' => ['sometimes', 'integer', 'exists:users,id', function ($attribute, $value, $fail) {
                $u = User::query()->find((int) $value);
                if (! $u || ! $u->isLab()) {
                    $fail('Le technicien doit être un utilisateur lab.');
                }
            }],
            'date_debut' => 'sometimes|date',
            'date_fin' => 'sometimes|date',
            'notes' => 'sometimes|nullable|string',
        ]);

        $debut = isset($data['date_debut'])
            ? (string) $data['date_debut']
            : $bcLignePlanningAffectation->date_debut->format('Y-m-d');
        $fin = isset($data['date_fin'])
            ? (string) $data['date_fin']
            : $bcLignePlanningAffectation->date_fin->format('Y-m-d');
        if ($debut > $fin) {
            return response()->json(['message' => 'La date de fin doit être après ou égale à la date de début.'], 422);
        }

        if (array_key_exists('date_debut', $data) || array_key_exists('date_fin', $data)) {
            $this->assertAssignmentWithinLigneWindow($bcLignePlanningAffectation->bonCommandeLigne, $debut, $fin);
        }

        $bcLignePlanningAffectation->update($data);

        return response()->json($bcLignePlanningAffectation->fresh()->load([
            'bonCommandeLigne.bonCommande.dossier',
            'bonCommandeLigne.bonCommande.client',
            'user',
        ]));
    }

    public function destroy(Request $request, BcLignePlanningAffectation $bcLignePlanningAffectation): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $bcLignePlanningAffectation->load('bonCommandeLigne.bonCommande');
        if (! AgencyAccess::userMayAccessBonCommande($request->user(), $bcLignePlanningAffectation->bonCommandeLigne->bonCommande)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $bcLignePlanningAffectation->delete();

        return response()->json(null, 204);
    }

    private function assertAssignmentWithinLigneWindow(BonCommandeLigne $ligne, string $debut, string $fin): void
    {
        if ($ligne->date_debut_prevue && $debut < $ligne->date_debut_prevue->format('Y-m-d')) {
            throw ValidationException::withMessages([
                'date_debut' => "L'affectation doit commencer au plus tôt le {$ligne->date_debut_prevue->format('Y-m-d')}.",
            ]);
        }
        if ($ligne->date_fin_prevue && $fin > $ligne->date_fin_prevue->format('Y-m-d')) {
            throw ValidationException::withMessages([
                'date_fin' => "L'affectation doit s'achever au plus tard le {$ligne->date_fin_prevue->format('Y-m-d')}.",
            ]);
        }
    }
}
