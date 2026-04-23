<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Groupes d'accès et agences laboratoire PROLAB
 *
 * Groupes calqués sur les services du labo BTP (codes PROLAB : BAHA, BAIH, GHCH, KHKH, RHCH) :
 *
 *  1. Direction & Responsables      (RHCH) — droits complets hors config système
 *  2. Techniciens Béton/Agrégats    (BAHA) — saisie essais + dossiers + lecture rapports
 *  3. Techniciens Géotechnique      (GHCH) — idem Béton
 *  4. Techniciens Inspection/Hydro  (BAIH) — idem Béton
 *  5. Contrôle Qualité / QSE        (KHKH) — lecture seule + rapports
 *  6. Commercial                    (---)  — commercial lecture/écriture + dossiers lecture
 *
 * Agences :
 *  - Agency 1 = "Laboratoire Principal — Siège" (client_id=1, déjà créée comme "Client Demo")
 *    → renommée + tous les utilisateurs PROLAB y sont rattachés
 */
class ProlabGroupsAgenciesSeeder extends Seeder
{
    /* ------------------------------------------------------------------ */
    /*  Permissions par groupe (clés issues de PermissionCatalog)          */
    /* ------------------------------------------------------------------ */
    private const GROUPS = [
        [
            'code'        => 'RHCH',
            'name'        => 'Direction & Responsables',
            'description' => 'Responsables de service et direction — accès complet commercial, dossiers, rapports et gestion utilisateurs.',
            'permissions' => [
                'users.manage',
                'groups.manage',
                'commercial.read',
                'commercial.write',
                'orders.read',
                'orders.write',
                'reports.read',
                'back_office.read',
            ],
        ],
        [
            'code'        => 'BAHA',
            'name'        => 'Techniciens Béton & Agrégats',
            'description' => 'Service Béton / Agrégats / Hydraulique / Assainissement — essais terrain et labo, saisie dossiers.',
            'permissions' => [
                'orders.read',
                'orders.write',
                'reports.read',
                'back_office.read',
            ],
        ],
        [
            'code'        => 'GHCH',
            'name'        => 'Techniciens Géotechnique & Chimie',
            'description' => 'Service Géotechnique / Hydraulique / Chimie hydraulique — essais géo, analyses chimiques.',
            'permissions' => [
                'orders.read',
                'orders.write',
                'reports.read',
                'back_office.read',
            ],
        ],
        [
            'code'        => 'BAIH',
            'name'        => 'Techniciens Inspection & Hydraulique',
            'description' => 'Service Inspection / Hydraulique — contrôle in-situ, mesures hydrauliques.',
            'permissions' => [
                'orders.read',
                'orders.write',
                'reports.read',
                'back_office.read',
            ],
        ],
        [
            'code'        => 'KHKH',
            'name'        => 'Contrôle Qualité & QSE',
            'description' => 'Service Contrôle Qualité / Qualité Sécurité Environnement — lecture et validation rapports.',
            'permissions' => [
                'orders.read',
                'reports.read',
                'back_office.read',
            ],
        ],
        [
            'code'        => 'COMM',
            'name'        => 'Commercial',
            'description' => 'Service commercial — gestion devis, bons de commande, facturation et suivi clients.',
            'permissions' => [
                'commercial.read',
                'commercial.write',
                'orders.read',
                'reports.read',
            ],
        ],
    ];

    /* ------------------------------------------------------------------ */
    /*  Utilisateurs → groupe (login@labo.ma → code groupe)               */
    /*  Seuls les profils identifiés précisément sont listés.             */
    /*  Les autres tombent dans le groupe par défaut (BAHA).              */
    /* ------------------------------------------------------------------ */
    private const USER_GROUP_MAP = [
        // Direction / Responsables (RHCH)
        'admin@labo.ma'          => 'RHCH',
        'm.karidi@labo.ma'       => 'RHCH',
        'kt.taib@labo.ma'        => 'RHCH',
        'r.cherkaoui@labo.ma'    => 'RHCH',
        'gh.cherkaoui@labo.ma'   => 'RHCH',
        'k.alaoui@labo.ma'       => 'RHCH',

        // Contrôle Qualité / QSE (KHKH)
        'kh.khetabi@labo.ma'     => 'KHKH',
        'a.atter@labo.ma'        => 'KHKH',
        'n.haddani@labo.ma'      => 'KHKH',

        // Géotechnique / Chimie (GHCH)
        'b.narjis@labo.ma'       => 'GHCH',
        'i.hattab@labo.ma'       => 'GHCH',
        'k.hicham@labo.ma'       => 'GHCH',
        's.boutouala@labo.ma'    => 'GHCH',
        'a.berkaoui@labo.ma'     => 'GHCH',
        'h.zahi@labo.ma'         => 'GHCH',
        't.rokia@labo.ma'        => 'GHCH',
        'a.mouna@labo.ma'        => 'GHCH',
        'm.aitnasser@labo.ma'    => 'GHCH',
        'a.amahrach@labo.ma'     => 'GHCH',
        'a.zemmari@labo.ma'      => 'GHCH',
        's.haddouni@labo.ma'     => 'GHCH',

        // Inspection / Hydraulique (BAIH)
        'f.hajjami@labo.ma'      => 'BAIH',
        's.hajjam@labo.ma'       => 'BAIH',
        'm.ballis@labo.ma'       => 'BAIH',
        'm.kardady@labo.ma'      => 'BAIH',
        's.ouidani@labo.ma'      => 'BAIH',
        'o.chemaou@labo.ma'      => 'BAIH',
        'a.zerouali@labo.ma'     => 'BAIH',

        // Commercial
        'gh.salem@labo.ma'       => 'COMM',
    ];

    /* ------------------------------------------------------------------ */

    public function run(): void
    {
        // 1. Créer les groupes d'accès
        $groupIds = [];
        foreach (self::GROUPS as $g) {
            $existing = DB::table('access_groups')->where('slug', Str::slug($g['name']))->first();
            if ($existing) {
                $groupIds[$g['code']] = $existing->id;
                DB::table('access_groups')->where('id', $existing->id)->update([
                    'permissions' => json_encode($g['permissions']),
                    'description' => $g['description'],
                    'updated_at'  => now(),
                ]);
                continue;
            }
            $id = DB::table('access_groups')->insertGetId([
                'name'        => $g['name'],
                'slug'        => Str::slug($g['name']).'-'.strtolower($g['code']),
                'description' => $g['description'],
                'permissions' => json_encode($g['permissions']),
                'created_at'  => now(),
                'updated_at'  => now(),
            ]);
            $groupIds[$g['code']] = $id;
        }
        $this->command->info('Groupes créés/mis à jour : '.count($groupIds));

        // 2. Affecter les utilisateurs PROLAB aux groupes
        $defaultGroup = 'BAHA';
        $users = DB::table('users')->where('email', 'like', '%@labo.ma')->get();

        $assigned = 0;
        foreach ($users as $user) {
            $code    = self::USER_GROUP_MAP[$user->email] ?? $defaultGroup;
            $groupId = $groupIds[$code] ?? $groupIds[$defaultGroup];

            $exists = DB::table('access_group_user')
                ->where('user_id', $user->id)
                ->where('access_group_id', $groupId)
                ->exists();

            if (! $exists) {
                DB::table('access_group_user')->insert([
                    'user_id'         => $user->id,
                    'access_group_id' => $groupId,
                    'created_at'      => now(),
                    'updated_at'      => now(),
                ]);
                $assigned++;
            }
        }
        $this->command->info("Utilisateurs affectés aux groupes : {$assigned}");

        // 3. Agence laboratoire — renommer l'agence HQ du client_id=1
        DB::table('agencies')
            ->where('client_id', 1)
            ->where('code', 'HQ')
            ->update([
                'name'       => 'Laboratoire Principal — Siège',
                'updated_at' => now(),
            ]);

        // 4. Rattacher tous les utilisateurs PROLAB à l'agence du labo (agency_id=1)
        $agencyId = DB::table('agencies')
            ->where('client_id', 1)
            ->where('code', 'HQ')
            ->value('id');

        if ($agencyId) {
            $linkedAgency = 0;
            foreach ($users as $user) {
                $exists = DB::table('agency_user')
                    ->where('agency_id', $agencyId)
                    ->where('user_id', $user->id)
                    ->exists();
                if (! $exists) {
                    DB::table('agency_user')->insert([
                        'agency_id'  => $agencyId,
                        'user_id'    => $user->id,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                    $linkedAgency++;
                }
            }
            $this->command->info("Utilisateurs rattachés à l'agence Labo (id={$agencyId}) : {$linkedAgency}");
        }

        // 5. Résumé
        $this->command->table(
            ['Groupe', 'Code', 'Nb droits', 'Users affectés'],
            array_map(function ($g) use ($groupIds) {
                $nb = DB::table('access_group_user')
                    ->where('access_group_id', $groupIds[$g['code']] ?? 0)
                    ->count();
                return [$g['name'], $g['code'], count($g['permissions']), $nb];
            }, self::GROUPS)
        );
    }
}
