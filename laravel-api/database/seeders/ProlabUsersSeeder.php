<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Seeder généré depuis SYS_Utilisateur.FIC (PROLAB HFSQL)
 * Sauvegarde extraite le 2026-04-23 — 83 utilisateurs PROLAB
 *
 * Domaine email : @labo.ma (login PROLAB converti en minuscules)
 * Mot de passe temporaire : ProLab2026! (à changer à la première connexion)
 * Rôle par défaut : lab_technician
 *
 * Groupes PROLAB détectés :
 *  BAHA — Béton/Agrégats/Hydraulique/Assainissement
 *  BAIH — Béton/Agrégats/Inspection/Hydraulique
 *  GHCH — Géotechnique/Hydraulique/Chimie
 *  KHKH — Contrôle qualité/Hydraulique
 *  RHCH — Responsable Chimie/Hydraulique
 */
class ProlabUsersSeeder extends Seeder
{
    public function run(): void
    {
        $defaultPassword = Hash::make('ProLab2026!');

        $users = [
            ['nom' => 'BAIROUK',             'prenom' => 'Sidi Ahmed',           'login' => 'a.bairouk'],
            ['nom' => 'EL AMIR',             'prenom' => 'Aallaha',              'login' => 'a.elamir'],
            ['nom' => 'MOUJAHID',            'prenom' => 'Abdelhalim',           'login' => 'a.moujahid'],
            ['nom' => 'BOUNISSAR',           'prenom' => 'Mohamed',              'login' => 'm.bounissar'],
            ['nom' => 'BOUJLAL',             'prenom' => 'Bachir',               'login' => 'b.boujlal'],
            ['nom' => 'YASSINE',             'prenom' => 'Siham',                'login' => 's.yassine'],
            ['nom' => 'EL OUALI',            'prenom' => 'El Fedel',             'login' => 'f.ouali'],
            ['nom' => 'EL HANAFI',           'prenom' => 'Bilal',                'login' => 'b.hanafi'],
            ['nom' => 'ARMOUZI',             'prenom' => 'Hajar',                'login' => 'h.armouzi'],
            ['nom' => 'EL MEGHARY',          'prenom' => 'Mohamed',              'login' => 'm.meghary'],
            ['nom' => 'EL KHARBAK',          'prenom' => 'Rachid',               'login' => 'r.kharbak'],
            ['nom' => 'OUELD EL RHERRABIA',  'prenom' => 'Rachida',              'login' => 'r.rherrabia'],
            ['nom' => 'EZZAIDI',             'prenom' => "M'Barka",              'login' => 'm.ezzaidi'],
            ['nom' => 'MESRAR',              'prenom' => 'Hajar',                'login' => 'h.mesrar'],
            ['nom' => 'EL MORABIT',          'prenom' => 'Aziz',                 'login' => 'a.morabit'],
            ['nom' => 'OUZIKI',              'prenom' => 'Abdelouahed',          'login' => 'a.ouziki'],
            ['nom' => 'EL WAHBI',            'prenom' => 'Lahcen',               'login' => 'l.wahbi'],
            ['nom' => 'EL ANSARI',           'prenom' => 'Fatima Ezzahra',       'login' => 'f.ansari'],
            ['nom' => 'AALLAM',              'prenom' => 'Ayoub',                'login' => 'a.aallam'],
            ['nom' => 'HADDANI',             'prenom' => 'Nezha',                'login' => 'n.haddani'],
            ['nom' => 'ABANI',               'prenom' => 'Abdelatif',            'login' => 'a.abani'],
            ['nom' => 'BOUDRAR',             'prenom' => 'Faical',               'login' => 'f.boudrar'],
            ['nom' => 'OUAHBI',              'prenom' => 'Said',                 'login' => 's.ouahbi'],
            ['nom' => 'BOURHIM',             'prenom' => 'Aberrahmane',          'login' => 'a.bourhim'],
            ['nom' => 'ABOUZAID',            'prenom' => 'Salka',                'login' => 's.abouzaid'],
            ['nom' => 'ABOUZAID',            'prenom' => 'Damahtou',             'login' => 'd.abouzaid'],
            ['nom' => 'BACHRAOUI',           'prenom' => 'Yassine',              'login' => 'y.bachraoui'],
            ['nom' => 'HAFIANE',             'prenom' => 'Hamza',                'login' => 'h.hafiane'],
            ['nom' => 'BOUSSIDOU',           'prenom' => 'Yasser',               'login' => 'y.boussidou'],
            ['nom' => 'BACHRAOUI',           'prenom' => 'Khalid',               'login' => 'kh.bachraoui'],
            ['nom' => 'LATILLAH',            'prenom' => 'Souad',                'login' => 's.latillah'],
            ['nom' => 'MIFTAH',              'prenom' => 'Mustapha',             'login' => 'm.miftah'],
            ['nom' => 'EL HIMER',            'prenom' => 'Bouchta',              'login' => 'b.himer'],
            ['nom' => 'BENAICHOUCH',         'prenom' => 'El Mahjoub',           'login' => 'm.benaichouch'],
            ['nom' => 'BRI',                 'prenom' => 'Abdeloifi',            'login' => 'a.bri'],
            ['nom' => 'MAKRINI',             'prenom' => 'Fadwa',                'login' => 'f.makrini'],
            ['nom' => 'AMJID',               'prenom' => 'Fatima Zahra',         'login' => 'f.amjid'],
            ['nom' => 'OUARZA',              'prenom' => 'Fatima Zahra',         'login' => 'f.ouarza'],
            ['nom' => 'CHERKAOUI',           'prenom' => 'Rhassane',             'login' => 'r.cherkaoui'],
            ['nom' => 'AMAHRACH',            'prenom' => 'Anass',                'login' => 'a.amahrach'],
            ['nom' => 'ZEMMARI',             'prenom' => 'Ayoub',                'login' => 'a.zemmari'],
            ['nom' => 'HADDOUNI',            'prenom' => 'Sara',                 'login' => 's.haddouni'],
            ['nom' => 'KACIMI ALAOUI',       'prenom' => 'Moulay Mustapha',      'login' => 'k.alaoui'],
            ['nom' => 'CHAGAF',              'prenom' => 'Ali Salem',            'login' => 'gh.salem'],
            ['nom' => 'CHERKAOUI',           'prenom' => 'Ghasan',               'login' => 'gh.cherkaoui'],
            ['nom' => 'BOUDIL',              'prenom' => 'Narjis',               'login' => 'b.narjis'],
            ['nom' => 'HATTAB',              'prenom' => 'Ikram',                'login' => 'i.hattab'],
            ['nom' => 'KIHEL',               'prenom' => 'Hicham',               'login' => 'k.hicham'],
            ['nom' => 'BOUTOUALA',           'prenom' => 'Soumiya',              'login' => 's.boutouala'],
            ['nom' => 'BERKAOUI',            'prenom' => 'Aziza',                'login' => 'a.berkaoui'],
            ['nom' => 'ZAHI',                'prenom' => 'Hanane',               'login' => 'h.zahi'],
            ['nom' => 'TALBI',               'prenom' => 'Rokia',                'login' => 't.rokia'],
            ['nom' => 'AMAL',                'prenom' => 'Mouna',                'login' => 'a.mouna'],
            ['nom' => 'AIT NASSER',          'prenom' => 'Meriem',               'login' => 'm.aitnasser'],
            ['nom' => 'KHETABI',             'prenom' => 'Khalid',               'login' => 'kh.khetabi'],
            ['nom' => 'ATTER',               'prenom' => 'Aziz',                 'login' => 'a.atter'],
            ['nom' => 'HAJJAMI',             'prenom' => 'Fatna',                'login' => 'f.hajjami'],
            ['nom' => 'HAJJAM',              'prenom' => 'Selma',                'login' => 's.hajjam'],
            ['nom' => 'BALLIS',              'prenom' => 'Mehdi',                'login' => 'm.ballis'],
            ['nom' => 'KARDADY',             'prenom' => 'Mohammed',             'login' => 'm.kardady'],
            ['nom' => 'OUIDANI',             'prenom' => 'Soumiya',              'login' => 's.ouidani'],
            ['nom' => 'CHEMAOU',             'prenom' => 'Omar',                 'login' => 'o.chemaou'],
            ['nom' => 'ZEROUALI',            'prenom' => 'Adil',                 'login' => 'a.zerouali'],
            ['nom' => 'EL KARIDI',           'prenom' => 'Tayeb',                'login' => 'kt.taib'],
            ['nom' => 'EL KARIDI',           'prenom' => 'Mounim',               'login' => 'm.karidi'],
            ['nom' => 'BAAMRANI',            'prenom' => 'Meriem',               'login' => 'm.baamrani'],
            ['nom' => 'KARRAKY',             'prenom' => 'Manal',                'login' => 'm.karraky'],
            ['nom' => 'MOUTAAZIZ',           'prenom' => 'Hajar',                'login' => 'h.moutaaziz'],
            ['nom' => 'MOUDEN',              'prenom' => 'Said',                 'login' => 's.mouden'],
            ['nom' => 'KHARMOUCH',           'prenom' => 'Sahar',                'login' => 's.kharmouch'],
            ['nom' => 'BELGHITI',            'prenom' => 'Youssef',              'login' => 'y.belghiti'],
            ['nom' => 'ESSAY',               'prenom' => 'Amal',                 'login' => 'a.essay'],
            ['nom' => 'ZAINOUNE',            'prenom' => 'Imane',                'login' => 'i.zainoune'],
            ['nom' => 'NASSIR',              'prenom' => 'Ibtihal',              'login' => 'i.nassir'],
            ['nom' => 'BARROUHOU',           'prenom' => 'Hajar',                'login' => 'h.barrouhou'],
            ['nom' => 'GOUMIRY',             'prenom' => 'Wahiba',               'login' => 'w.goumiry'],
            ['nom' => 'LAAKEL',              'prenom' => 'Souad',                'login' => 's.laakel'],
            ['nom' => 'OUAJID',              'prenom' => 'Safae',                'login' => 's.ouajid'],
            ['nom' => 'ASSAS',               'prenom' => 'Safaa',                'login' => 's.assas'],
            ['nom' => 'BOUGHALGA',           'prenom' => 'Hassan',               'login' => 'h.boughalga'],
            ['nom' => 'BELGITI',             'prenom' => 'Fatima Zahra',         'login' => 'f.belgiti'],
            ['nom' => 'SAAMMY',              'prenom' => 'Mohammed',             'login' => 'm.saammy'],
            ['nom' => 'HAMIDI',              'prenom' => 'Omar',                 'login' => 'o.hamidi'],
            ['nom' => 'AOUZAL',              'prenom' => 'Abdellah',             'login' => 'a.aouzal'],
            // Compte admin/commercial identifié
            ['nom' => 'EL KARIDI',           'prenom' => 'Mounim',               'login' => 'admin',    'role' => 'lab_admin'],
        ];

        $inserted = 0;
        $skipped  = 0;

        foreach ($users as $u) {
            $email = strtolower($u['login']) . '@labo.ma';
            $name  = ucwords(strtolower($u['prenom'])) . ' ' . mb_strtoupper($u['nom']);
            $role  = $u['role'] ?? 'lab_technician';

            // Ignorer si email ou login déjà présent
            $exists = DB::table('users')
                ->where('email', $email)
                ->orWhere('name', $name)
                ->exists();

            if ($exists) {
                $skipped++;
                continue;
            }

            DB::table('users')->insert([
                'name'              => $name,
                'email'             => $email,
                'password'          => $defaultPassword,
                'role'              => $role,
                'email_verified_at' => now(),
                'created_at'        => now(),
                'updated_at'        => now(),
            ]);
            $inserted++;
        }

        $this->command->info("ProlabUsersSeeder : {$inserted} utilisateurs importés, {$skipped} ignorés (existants).");
        $this->command->warn('Mot de passe temporaire : ProLab2026! — demander aux utilisateurs de le changer.');
    }
}
