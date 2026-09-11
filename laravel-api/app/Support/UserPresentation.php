<?php

namespace App\Support;

use App\Models\User;

final class UserPresentation
{
    /** @return array<string, string> */
    public static function roleLabels(): array
    {
        return [
            User::ROLE_LAB_ADMIN => 'Administrateur laboratoire',
            User::ROLE_LAB_TECHNICIAN => 'Technicien laboratoire',
            User::ROLE_COMMERCIAL => 'Commercial',
            User::ROLE_INGENIEUR => 'Ingénieur',
            User::ROLE_LABORANTIN => 'Laborantin',
            User::ROLE_RESPONSABLE => 'Responsable',
            User::ROLE_RECEPTIONNAIRE => 'Réceptionnaire',
            User::ROLE_CLIENT => 'Client',
            User::ROLE_SITE_CONTACT => 'Contact chantier',
        ];
    }

    public static function roleLabel(?string $role): string
    {
        if ($role === null || $role === '') {
            return '—';
        }

        return self::roleLabels()[$role] ?? $role;
    }

    public static function posteLabel(?string $poste, ?string $role): string
    {
        $trimmed = is_string($poste) ? trim($poste) : '';
        if ($trimmed !== '') {
            return $trimmed;
        }

        return self::roleLabel($role);
    }

    /** @return array{id: int, name: string, email: string, role: string, poste: string|null, poste_label: string} */
    public static function technicienPayload(User $user): array
    {
        return [
            'id' => (int) $user->id,
            'name' => (string) $user->name,
            'email' => (string) $user->email,
            'role' => (string) $user->role,
            'poste' => $user->poste,
            'poste_label' => self::posteLabel($user->poste, $user->role),
        ];
    }
}
