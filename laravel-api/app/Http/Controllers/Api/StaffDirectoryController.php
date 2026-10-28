<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\UserPresentation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Annuaire du personnel interne (non paginé) pour les listes déroulantes
 * « Assigné à », « Technicien », « Collecté par »… — accessible à tout le personnel
 * interne, contrairement à /admin/users réservé à la gestion des utilisateurs.
 */
class StaffDirectoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()->isInternal(), 403, 'Non autorisé');

        return response()->json(
            User::query()
                ->whereIn('role', User::ROLES_INTERNAL)
                ->orderBy('name')
                ->get(['id', 'name', 'email', 'role', 'poste', 'agency_id'])
                ->map(fn (User $u) => [...UserPresentation::technicienPayload($u), 'agency_id' => $u->agency_id])
                ->values()
        );
    }
}
