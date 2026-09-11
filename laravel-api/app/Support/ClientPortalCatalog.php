<?php

namespace App\Support;

/**
 * Modules activables pour le portail client (distinct du PermissionCatalog interne).
 */
final class ClientPortalCatalog
{
    public const DOSSIERS = 'dossiers';

    public const INTERVENTIONS = 'interventions';

    public const RAPPORTS = 'rapports';

    public const DEVIS = 'devis';

    public const FACTURES = 'factures';

    public const DOCUMENTS = 'documents';

    /** @return list<string> */
    public static function keys(): array
    {
        return [
            self::DOSSIERS,
            self::INTERVENTIONS,
            self::RAPPORTS,
            self::DEVIS,
            self::FACTURES,
            self::DOCUMENTS,
        ];
    }

    /** @return array<string, string> */
    public static function labels(): array
    {
        return [
            self::DOSSIERS => 'Mes dossiers',
            self::INTERVENTIONS => 'Interventions (planifiées / en cours)',
            self::RAPPORTS => 'Rapports d\'essais livrés',
            self::DEVIS => 'Devis',
            self::FACTURES => 'Factures',
            self::DOCUMENTS => 'Documents partagés',
        ];
    }

    /** @return list<string> */
    public static function defaults(): array
    {
        return [
            self::DOSSIERS,
            self::INTERVENTIONS,
            self::RAPPORTS,
        ];
    }

    /**
     * @param  list<string>|null  $stored
     * @return list<string>
     */
    public static function normalize(?array $stored): array
    {
        if ($stored === null || $stored === []) {
            return self::defaults();
        }

        $allowed = array_flip(self::keys());
        $out = [];
        foreach ($stored as $key) {
            if (is_string($key) && isset($allowed[$key]) && ! in_array($key, $out, true)) {
                $out[] = $key;
            }
        }

        return $out !== [] ? $out : self::defaults();
    }
}
