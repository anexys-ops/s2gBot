<?php

namespace App\Support;

use App\Models\User;

class UserExpenseBareme
{
    public const DEFAULT_TAUX_KM = 0.401;

    /**
     * @return array{taux_km: float, plafond_repas: ?float, forfait_repas: ?float}
     */
    public static function forUser(?User $user): array
    {
        if ($user === null) {
            return [
                'taux_km'       => self::DEFAULT_TAUX_KM,
                'plafond_repas' => null,
                'forfait_repas' => null,
            ];
        }

        return [
            'taux_km'       => (float) ($user->expense_taux_km ?? self::DEFAULT_TAUX_KM),
            'plafond_repas' => $user->expense_plafond_repas !== null
                ? (float) $user->expense_plafond_repas
                : null,
            'forfait_repas' => $user->expense_forfait_repas !== null
                ? (float) $user->expense_forfait_repas
                : null,
        ];
    }

    public static function defaultTauxKm(?User $user = null): float
    {
        return self::forUser($user)['taux_km'];
    }
}
