<?php

namespace App\Support;

/**
 * Spécification OpenAPI 3.0 (aperçu des routes /api) — enrichie progressivement.
 */
class OpenApiSpec
{
    public static function document(): array
    {
        $base = [
            'openapi' => '3.0.3',
            'info' => [
                'title' => 'Lab BTP — API',
                'description' => 'API REST Laravel (Sanctum). Les routes protégées nécessitent `Authorization: Bearer {token}`.',
                'version' => AppVersion::resolve(),
            ],
            'servers' => [
                ['url' => '/api', 'description' => 'API (même origine que le front en dev)'],
            ],
            'tags' => [
                ['name' => 'Auth', 'description' => 'Connexion, inscription, session'],
                ['name' => 'Public', 'description' => 'Sans authentification'],
                ['name' => 'CRM', 'description' => 'Clients, chantiers, devis, factures'],
                ['name' => 'Labo', 'description' => 'Commandes, échantillons, résultats, rapports'],
                ['name' => 'Stats', 'description' => 'Statistiques et tableaux de bord'],
                ['name' => 'Référentiels', 'description' => 'Types d’essais, catalogue, PDF, mails'],
                ['name' => 'Terrain mobile', 'description' => 'Mesures et photos dossiers chantier / commande'],
                ['name' => 'Admin', 'description' => 'Utilisateurs, groupes, configuration'],
            ],
            'components' => [
                'securitySchemes' => [
                    'sanctum' => [
                        'type' => 'http',
                        'scheme' => 'bearer',
                        'bearerFormat' => 'Token',
                        'description' => 'Jeton Sanctum (SPA ou jeton API)',
                    ],
                ],
            ],
            'security' => [['sanctum' => []]],
            'paths' => array_merge(
                self::publicPaths(),
                self::authPaths(),
                self::crmPaths(),
                self::laboPaths(),
                self::statsPaths(),
                self::refPaths(),
                self::mobilePaths(),
                self::adminPaths(),
            ),
        ];

        return $base;
    }

    private static function publicPaths(): array
    {
        return [
            '/version' => [
                'get' => [
                    'tags' => ['Public'],
                    'summary' => 'Version API / Laravel / PHP',
                    'security' => [],
                    'responses' => ['200' => ['description' => 'OK']],
                ],
            ],
        ];
    }

    private static function authPaths(): array
    {
        return [
            '/login' => [
                'post' => [
                    'tags' => ['Auth'],
                    'summary' => 'Connexion',
                    'security' => [],
                    'requestBody' => [
                        'required' => true,
                        'content' => [
                            'application/json' => [
                                'schema' => [
                                    'type' => 'object',
                                    'required' => ['email', 'password'],
                                    'properties' => [
                                        'email' => ['type' => 'string', 'format' => 'email'],
                                        'password' => ['type' => 'string'],
                                    ],
                                ],
                            ],
                        ],
                    ],
                    'responses' => ['200' => ['description' => 'user + token']],
                ],
            ],
            '/logout' => [
                'post' => [
                    'tags' => ['Auth'],
                    'summary' => 'Déconnexion',
                    'responses' => ['204' => ['description' => 'OK']],
                ],
            ],
            '/user' => [
                'get' => [
                    'tags' => ['Auth'],
                    'summary' => 'Utilisateur courant',
                    'responses' => ['200' => ['description' => 'User']],
                ],
            ],
        ];
    }

    private static function crmPaths(): array
    {
        return [
            '/clients' => [
                'get' => ['tags' => ['CRM'], 'summary' => 'Liste clients', 'responses' => ['200' => ['description' => 'OK']]],
                'post' => ['tags' => ['CRM'], 'summary' => 'Créer client', 'responses' => ['201' => ['description' => 'Créé']]],
            ],
            '/clients/{client}' => [
                'get' => ['tags' => ['CRM'], 'summary' => 'Détail client', 'parameters' => [self::pathId('client')], 'responses' => ['200' => ['description' => 'OK']]],
                'put' => ['tags' => ['CRM'], 'summary' => 'Maj client', 'parameters' => [self::pathId('client')], 'responses' => ['200' => ['description' => 'OK']]],
                'delete' => ['tags' => ['CRM'], 'summary' => 'Supprimer client', 'parameters' => [self::pathId('client')], 'responses' => ['204' => ['description' => 'OK']]],
            ],
            '/sites' => [
                'get' => ['tags' => ['CRM'], 'summary' => 'Liste chantiers', 'responses' => ['200' => ['description' => 'OK']]],
                'post' => ['tags' => ['CRM'], 'summary' => 'Créer chantier', 'responses' => ['201' => ['description' => 'Créé']]],
            ],
            '/sites/{site}' => [
                'get' => ['tags' => ['CRM'], 'summary' => 'Détail chantier', 'parameters' => [self::pathId('site')], 'responses' => ['200' => ['description' => 'OK']]],
                'put' => ['tags' => ['CRM'], 'summary' => 'Maj chantier', 'parameters' => [self::pathId('site')], 'responses' => ['200' => ['description' => 'OK']]],
                'delete' => ['tags' => ['CRM'], 'summary' => 'Supprimer chantier', 'parameters' => [self::pathId('site')], 'responses' => ['204' => ['description' => 'OK']]],
            ],
            '/quotes' => [
                'get' => ['tags' => ['CRM'], 'summary' => 'Liste devis', 'responses' => ['200' => ['description' => 'OK']]],
                'post' => ['tags' => ['CRM'], 'summary' => 'Créer devis', 'responses' => ['201' => ['description' => 'Créé']]],
            ],
            '/invoices' => [
                'get' => ['tags' => ['CRM'], 'summary' => 'Liste factures', 'responses' => ['200' => ['description' => 'OK']]],
                'post' => ['tags' => ['CRM'], 'summary' => 'Créer facture', 'responses' => ['201' => ['description' => 'Créé']]],
            ],
        ];
    }

    private static function laboPaths(): array
    {
        return [
            '/orders' => [
                'get' => ['tags' => ['Labo'], 'summary' => 'Liste commandes / dossiers', 'responses' => ['200' => ['description' => 'OK']]],
                'post' => ['tags' => ['Labo'], 'summary' => 'Créer commande', 'responses' => ['201' => ['description' => 'Créé']]],
            ],
            '/orders/{order}' => [
                'get' => ['tags' => ['Labo'], 'summary' => 'Détail commande', 'parameters' => [self::pathId('order')], 'responses' => ['200' => ['description' => 'OK']]],
                'put' => ['tags' => ['Labo'], 'summary' => 'Maj commande', 'parameters' => [self::pathId('order')], 'responses' => ['200' => ['description' => 'OK']]],
                'delete' => ['tags' => ['Labo'], 'summary' => 'Supprimer commande', 'parameters' => [self::pathId('order')], 'responses' => ['204' => ['description' => 'OK']]],
            ],
            '/orders/{order}/reports' => [
                'get' => ['tags' => ['Labo'], 'summary' => 'Liste rapports PDF', 'parameters' => [self::pathId('order')], 'responses' => ['200' => ['description' => 'OK']]],
                'post' => ['tags' => ['Labo'], 'summary' => 'Générer rapport', 'parameters' => [self::pathId('order')], 'responses' => ['201' => ['description' => 'Rapport']]],
            ],
            '/test-types' => [
                'get' => ['tags' => ['Labo'], 'summary' => 'Types d’essais', 'responses' => ['200' => ['description' => 'OK']]],
            ],
            '/samples/{sample}/results' => [
                'post' => ['tags' => ['Labo'], 'summary' => 'Saisir résultat d’essai', 'parameters' => [self::pathId('sample')], 'responses' => ['201' => ['description' => 'OK']]],
            ],
        ];
    }

    private static function statsPaths(): array
    {
        return [
            '/stats/dashboard' => [
                'get' => [
                    'tags' => ['Stats'],
                    'summary' => 'Indicateurs tableau de bord / compta',
                    'responses' => ['200' => ['description' => 'Montants, compteurs, CA par mois']],
                ],
            ],
            '/stats/essais' => [
                'get' => [
                    'tags' => ['Stats'],
                    'summary' => 'Statistiques essais',
                    'responses' => ['200' => ['description' => 'OK']],
                ],
            ],
        ];
    }

    private static function refPaths(): array
    {
        return [
            '/branding' => [
                'get' => ['tags' => ['Référentiels'], 'summary' => 'URL logo charte', 'responses' => ['200' => ['description' => 'logo_url']]],
            ],
            '/report-pdf-templates' => [
                'get' => ['tags' => ['Référentiels'], 'summary' => 'Modèles PDF rapports', 'responses' => ['200' => ['description' => 'OK']]],
            ],
            '/document-pdf-templates' => [
                'get' => ['tags' => ['Référentiels'], 'summary' => 'Modèles PDF devis / factures', 'responses' => ['200' => ['description' => 'OK']]],
            ],
            '/pdf/templates' => [
                'get' => ['tags' => ['Référentiels'], 'summary' => 'Modèles génération PDF', 'responses' => ['200' => ['description' => 'OK']]],
            ],
            '/pdf/generate' => [
                'post' => [
                    'tags' => ['Référentiels'],
                    'summary' => 'Générer PDF (devis, facture, rapport)',
                    'responses' => ['200' => ['description' => 'Flux PDF']],
                ],
            ],
        ];
    }

    private static function mobilePaths(): array
    {
        return [
            '/mobile/dossiers/{kind}/{id}/measure-forms' => [
                'get' => [
                    'tags' => ['Terrain mobile'],
                    'summary' => 'Formulaires de mesure (order|site)',
                    'parameters' => [
                        ['name' => 'kind', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'string', 'enum' => ['order', 'site']]],
                        self::pathId('id'),
                    ],
                    'responses' => ['200' => ['description' => 'OK']],
                ],
            ],
            '/mobile/dossiers/{kind}/{id}/measure-submissions' => [
                'post' => [
                    'tags' => ['Terrain mobile'],
                    'summary' => 'Soumettre mesures terrain',
                    'parameters' => [
                        ['name' => 'kind', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'string', 'enum' => ['order', 'site']]],
                        self::pathId('id'),
                    ],
                    'responses' => ['201' => ['description' => 'OK']],
                ],
            ],
        ];
    }

    private static function adminPaths(): array
    {
        return [
            '/admin/users' => [
                'get' => ['tags' => ['Admin'], 'summary' => 'Liste utilisateurs', 'responses' => ['200' => ['description' => 'OK']]],
            ],
            '/module-settings/{module_key}' => [
                'get' => ['tags' => ['Admin'], 'summary' => 'Réglages module', 'parameters' => [self::pathStr('module_key')], 'responses' => ['200' => ['description' => 'OK']]],
                'put' => ['tags' => ['Admin'], 'summary' => 'Maj réglages module', 'parameters' => [self::pathStr('module_key')], 'responses' => ['200' => ['description' => 'OK']]],
            ],
        ];
    }

    private static function pathId(string $name): array
    {
        return [
            'name' => $name,
            'in' => 'path',
            'required' => true,
            'schema' => ['type' => 'integer'],
        ];
    }

    private static function pathStr(string $name): array
    {
        return [
            'name' => $name,
            'in' => 'path',
            'required' => true,
            'schema' => ['type' => 'string'],
        ];
    }
}
