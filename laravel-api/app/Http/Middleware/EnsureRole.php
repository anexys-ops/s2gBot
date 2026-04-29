<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * v1.2.0 — Garde RBAC par rôle métier.
 *
 * Usage : `Route::middleware('role:commercial,responsable,lab_admin')->group(...)`.
 *
 * `lab_admin` est implicitement autorisé : pas besoin de l'inclure dans la liste,
 * mais il est accepté si présent (pour la lisibilité des routes).
 */
class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user instanceof User) {
            return response()->json(['message' => 'Non authentifié.'], 401);
        }

        // Lab admin = bypass — préserve la sémantique historique du projet.
        if ($user->isLabAdmin()) {
            return $next($request);
        }

        if ($roles && in_array($user->role, $roles, true)) {
            return $next($request);
        }

        return response()->json([
            'message' => 'Accès refusé : rôle requis.',
            'required_roles' => $roles,
            'role' => $user->role,
        ], 403);
    }
}
