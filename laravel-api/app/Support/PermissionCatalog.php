<?php

namespace App\Support;

/**
 * Droits applicatifs (hors rôle lab_admin qui a tout).
 * Stockés en JSON sur les groupes d’accès.
 *
 * modules.* = visibilité des menus / zones applicatives.
 * commercial.*, orders.*, etc. = fonctions fines au sein des modules.
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

    public const MODULE_COMMERCIAL = 'modules.commercial';

    public const MODULE_DOSSIERS = 'modules.dossiers';

    public const MODULE_TERRAIN = 'modules.terrain';

    public const MODULE_LABORATOIRE = 'modules.laboratoire';

    public const MODULE_INGENIERIE = 'modules.ingenierie';

    public const MODULE_CATALOGUE = 'modules.catalogue';

    public const MODULE_RAPPORTS = 'modules.rapports';

    public const MODULE_CONFIGURATION = 'modules.configuration';

    /** Wildcard : toutes les capacités du catalogue (sauf équivalent admin métier). */
    public const ALL_MARKER = '*';

    /**
     * @return array<string, string> key => libellé UI
     */
    public static function labels(): array
    {
        return [
            self::MODULE_COMMERCIAL => 'Module Commercial — clients, devis, BC/BL, factures',
            self::MODULE_DOSSIERS => 'Module Dossiers — consultation et suivi dossiers',
            self::MODULE_TERRAIN => 'Module Terrain — chantiers, mesures, tâches terrain, OdM terrain',
            self::MODULE_LABORATOIRE => 'Module Laboratoire — réception, essais, tâches labo, OdM labo',
            self::MODULE_INGENIERIE => 'Module Ingénierie — tâches et OdM ingénieur',
            self::MODULE_CATALOGUE => 'Module Catalogue — articles S2G, matériel, fiches techniques',
            self::MODULE_RAPPORTS => 'Module Rapports — ventes, compta, KPI',
            self::MODULE_CONFIGURATION => 'Module Configuration — agences, utilisateurs, PDF, modules',
            self::COMMERCIAL_READ => 'Commercial — lecture (devis, factures, documents)',
            self::COMMERCIAL_WRITE => 'Commercial — écriture',
            self::ORDERS_READ => 'Commandes & dossiers — lecture',
            self::ORDERS_WRITE => 'Commandes & dossiers — écriture',
            self::REPORTS_READ => 'Rapports & statistiques — lecture',
            self::BACK_OFFICE_READ => 'Back office — accès lecture (catalogue, outils)',
            self::USERS_MANAGE => 'Utilisateurs — création / modification / suppression',
            self::GROUPS_MANAGE => 'Groupes — gestion des groupes et des droits',
            self::CONFIG_MANAGE => 'Configuration — extrafields, modules, réglages avancés',
            self::ALL_MARKER => 'Tout accorder (équivalent complet hors admin système)',
        ];
    }

    /**
     * Regroupement pour l’UI « Groupes & droits ».
     *
     * @return array<string, list<string>>
     */
    public static function groups(): array
    {
        return [
            'Modules visibles' => [
                self::MODULE_COMMERCIAL,
                self::MODULE_DOSSIERS,
                self::MODULE_TERRAIN,
                self::MODULE_LABORATOIRE,
                self::MODULE_INGENIERIE,
                self::MODULE_CATALOGUE,
                self::MODULE_RAPPORTS,
                self::MODULE_CONFIGURATION,
            ],
            'Fonctions métier' => [
                self::COMMERCIAL_READ,
                self::COMMERCIAL_WRITE,
                self::ORDERS_READ,
                self::ORDERS_WRITE,
                self::REPORTS_READ,
                self::BACK_OFFICE_READ,
            ],
            'Administration' => [
                self::USERS_MANAGE,
                self::GROUPS_MANAGE,
                self::CONFIG_MANAGE,
                self::ALL_MARKER,
            ],
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
     * @return list<string>
     */
    public static function moduleKeys(): array
    {
        return [
            self::MODULE_COMMERCIAL,
            self::MODULE_DOSSIERS,
            self::MODULE_TERRAIN,
            self::MODULE_LABORATOIRE,
            self::MODULE_INGENIERIE,
            self::MODULE_CATALOGUE,
            self::MODULE_RAPPORTS,
            self::MODULE_CONFIGURATION,
        ];
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

    /**
     * Complète les permissions explicites avec les modules déduits (rétrocompatibilité groupes existants).
     *
     * @param  array<int, string>  $permissions
     * @return list<string>
     */
    public static function expandEffective(array $permissions): array
    {
        $sanitized = self::sanitize($permissions);
        if (in_array(self::ALL_MARKER, $sanitized, true)) {
            return self::keys();
        }

        $out = array_fill_keys($sanitized, true);

        $has = static fn (string $key): bool => isset($out[$key]);

        if ($has(self::MODULE_COMMERCIAL) || $has(self::COMMERCIAL_READ) || $has(self::COMMERCIAL_WRITE)) {
            $out[self::MODULE_COMMERCIAL] = true;
        }

        if ($has(self::MODULE_DOSSIERS) || $has(self::ORDERS_READ) || $has(self::ORDERS_WRITE)) {
            $out[self::MODULE_DOSSIERS] = true;
        }

        if ($has(self::MODULE_TERRAIN)) {
            $out[self::MODULE_TERRAIN] = true;
        } elseif ($has(self::ORDERS_WRITE) && ! $has(self::COMMERCIAL_READ) && ! $has(self::COMMERCIAL_WRITE) && ! $has(self::MODULE_COMMERCIAL)) {
            $out[self::MODULE_TERRAIN] = true;
        }

        if ($has(self::MODULE_LABORATOIRE)) {
            $out[self::MODULE_LABORATOIRE] = true;
        } elseif ($has(self::ORDERS_WRITE) && ! $has(self::COMMERCIAL_READ) && ! $has(self::COMMERCIAL_WRITE) && ! $has(self::MODULE_COMMERCIAL)) {
            $out[self::MODULE_LABORATOIRE] = true;
        }

        if ($has(self::MODULE_INGENIERIE)) {
            $out[self::MODULE_INGENIERIE] = true;
        } elseif ($has(self::ORDERS_WRITE) && ! $has(self::COMMERCIAL_READ) && ! $has(self::COMMERCIAL_WRITE) && ! $has(self::MODULE_COMMERCIAL)) {
            $out[self::MODULE_INGENIERIE] = true;
        }

        if ($has(self::MODULE_CATALOGUE) || $has(self::BACK_OFFICE_READ)) {
            $out[self::MODULE_CATALOGUE] = true;
        }

        if ($has(self::MODULE_RAPPORTS) || $has(self::REPORTS_READ)) {
            $out[self::MODULE_RAPPORTS] = true;
        }

        if ($has(self::MODULE_CONFIGURATION) || $has(self::USERS_MANAGE) || $has(self::GROUPS_MANAGE) || $has(self::CONFIG_MANAGE)) {
            $out[self::MODULE_CONFIGURATION] = true;
        }

        return array_keys($out);
    }
}
