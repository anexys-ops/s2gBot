<?php

namespace App\Support;

/**
 * Droits applicatifs (hors rôle lab_admin qui a tout).
 * Stockés en JSON sur les groupes d’accès.
 */
final class PermissionCatalog
{
    public const USERS_MANAGE = 'users.manage';

    public const GROUPS_MANAGE = 'groups.manage';

    public const CONFIG_MANAGE = 'config.manage';

    public const COMMERCIAL_READ = 'commercial.read';

    public const COMMERCIAL_WRITE = 'commercial.write';

    public const ORDERS_READ = 'orders.read';

    public const ORDERS_WRITE = 'orders.write';

    public const REPORTS_READ = 'reports.read';

    public const BACK_OFFICE_READ = 'back_office.read';

    /** Wildcard : toutes les capacités du catalogue (sauf équivalent admin métier). */
    public const ALL_MARKER = '*';

    /**
     * @return array<string, string> key => libellé UI
     */
    public static function labels(): array
    {
        return [
            self::USERS_MANAGE => 'Utilisateurs — création / modification / suppression',
            self::GROUPS_MANAGE => 'Groupes — gestion des groupes et des droits',
            self::CONFIG_MANAGE => 'Configuration — extrafields, modules, réglages avancés',
            self::COMMERCIAL_READ => 'Commercial — lecture (devis, factures, documents)',
            self::COMMERCIAL_WRITE => 'Commercial — écriture',
            self::ORDERS_READ => 'Commandes & dossiers — lecture',
            self::ORDERS_WRITE => 'Commandes & dossiers — écriture',
            self::REPORTS_READ => 'Rapports & statistiques — lecture',
            self::BACK_OFFICE_READ => 'Back office — accès lecture (catalogue, outils)',
            self::ALL_MARKER => 'Tout accorder (équivalent complet hors admin système)',
        ];
    }

    /**
     * @return list<string>
     */
    public static function keys(): array
    {
        return array_keys(self::labels());
    }

    /**
     * @param  array<int, string>  $permissions
     * @return list<string>
     */
    public static function sanitize(array $permissions): array
    {
        $allowed = array_flip(self::keys());
        $out = [];
        foreach ($permissions as $p) {
            if (is_string($p) && isset($allowed[$p])) {
                $out[] = $p;
            }
        }

        return array_values(array_unique($out));
    }
}
