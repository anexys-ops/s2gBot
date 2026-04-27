<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Models\Calibration;
use App\Models\Equipment;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

class MaterielDemoSeeder extends Seeder
{
    public function run(): void
    {
        // ── 1. Techniciens ───────────────────────────────────────────
        $technicienData = [
            ['name' => 'Youssef Alami',   'email' => 'youssef.alami@labo.ma'],
            ['name' => 'Mehdi Bensalah',  'email' => 'mehdi.bensalah@labo.ma'],
            ['name' => 'Amine Tazi',      'email' => 'amine.tazi@labo.ma'],
            ['name' => 'Sara Moussaoui',  'email' => 'sara.moussaoui@labo.ma'],
            ['name' => 'Karim Idrissi',   'email' => 'karim.idrissi@labo.ma'],
            ['name' => 'Fatima Zerhouni', 'email' => 'fatima.zerhouni@labo.ma'],
            ['name' => 'Omar Chraibi',    'email' => 'omar.chraibi@labo.ma'],
            ['name' => 'Nadia Benali',    'email' => 'nadia.benali@labo.ma'],
        ];

        $techniciens = [];
        foreach ($technicienData as $d) {
            $techniciens[] = User::firstOrCreate(
                ['email' => $d['email']],
                [
                    'name'     => $d['name'],
                    'password' => Hash::make('password'),
                    'role'     => User::ROLE_LAB_TECHNICIAN,
                ]
            );
        }

        // ── 2. Agences ───────────────────────────────────────────────
        $agences = [
            Agency::firstOrCreate(['name' => 'Agence Casablanca'], ['code' => 'AGC-CASA', 'is_headquarters' => true]),
            Agency::firstOrCreate(['name' => 'Agence Rabat'],      ['code' => 'AGC-RBAT']),
            Agency::firstOrCreate(['name' => 'Agence Marrakech'],  ['code' => 'AGC-MARR']),
        ];

        // ── 3. Équipements ───────────────────────────────────────────
        $equipements = [
            ['name' => 'Presse hydraulique 3000 kN',        'code' => 'PH-3000',    'type' => 'Presse',           'brand' => 'Controls',          'model' => 'Pilot 4',            'serial_number' => 'CTR-2021-00123',  'status' => Equipment::STATUS_ACTIVE,       'categorie' => 'appareil_mesure', 'numero_inventaire' => 'MAT-2026-001', 'valeur_acquisition_ht' => 85000,  'fournisseur' => 'SOGETEC Maroc',        'purchase_date' => '2021-03-15', 'heures' => 3200, 'reparation' => false],
            ['name' => 'Presse cylindrique CBR',             'code' => 'CBR-50',     'type' => 'Presse CBR',       'brand' => 'ELE International', 'model' => 'CBR 50 kN',          'serial_number' => 'ELE-2020-4412',   'status' => Equipment::STATUS_ACTIVE,       'categorie' => 'appareil_mesure', 'numero_inventaire' => 'MAT-2026-002', 'valeur_acquisition_ht' => 42000,  'fournisseur' => 'SOGETEC Maroc',        'purchase_date' => '2020-06-01', 'heures' => 2800, 'reparation' => false],
            ['name' => 'Appareil Proctor modifié',           'code' => 'PROCT-MOD',  'type' => 'Proctor',          'brand' => 'ELE International', 'model' => 'Proctor Heavy',       'serial_number' => 'ELE-2019-9981',   'status' => Equipment::STATUS_ACTIVE,       'categorie' => 'appareil_mesure', 'numero_inventaire' => 'MAT-2026-003', 'valeur_acquisition_ht' => 18000,  'fournisseur' => 'SOGETEC Maroc',        'purchase_date' => '2019-09-20', 'heures' => 4100, 'reparation' => false],
            ['name' => 'Jeu de tamis 0.08-80mm',             'code' => 'TAMIS-01',   'type' => 'Tamis',            'brand' => 'Retsch',            'model' => 'Série ISO 3310',      'serial_number' => 'RET-2022-1201',   'status' => Equipment::STATUS_MAINTENANCE,  'categorie' => 'laboratoire',     'numero_inventaire' => 'MAT-2026-004', 'valeur_acquisition_ht' => 8500,   'fournisseur' => 'Retsch GmbH',          'purchase_date' => '2022-01-10', 'heures' => 1500, 'reparation' => true],
            ['name' => 'Etuve 200°C 300L',                   'code' => 'ETUVE-300',  'type' => 'Etuve',            'brand' => 'Memmert',           'model' => 'UF 260 Plus',         'serial_number' => 'MMT-2023-0087',   'status' => Equipment::STATUS_ACTIVE,       'categorie' => 'laboratoire',     'numero_inventaire' => 'MAT-2026-005', 'valeur_acquisition_ht' => 24000,  'fournisseur' => 'Memmert France',       'purchase_date' => '2023-02-14', 'heures' => 800,  'reparation' => false],
            ['name' => 'Toyota HiLux – Plateau terrain',     'code' => 'VEH-HIL-01', 'type' => 'Véhicule',        'brand' => 'Toyota',            'model' => 'HiLux 4x4 Double Cab','serial_number' => 'WB4A3XXX2024001', 'status' => Equipment::STATUS_ACTIVE,       'categorie' => 'vehicule',        'numero_inventaire' => 'MAT-2026-006', 'valeur_acquisition_ht' => 145000, 'fournisseur' => 'Toyota Maroc',         'purchase_date' => '2024-01-08', 'heures' => 620,  'reparation' => false],
            ['name' => 'Ford Transit – Laboratoire mobile',  'code' => 'VEH-FT-01',  'type' => 'Véhicule',        'brand' => 'Ford',              'model' => 'Transit 350 L3H2',    'serial_number' => 'WF0XXXTTGXXB1234','status' => Equipment::STATUS_ACTIVE,       'categorie' => 'vehicule',        'numero_inventaire' => 'MAT-2026-007', 'valeur_acquisition_ht' => 118000, 'fournisseur' => 'Ford Auto Maroc',      'purchase_date' => '2022-11-30', 'heures' => 1850, 'reparation' => false],
            ['name' => 'GPS Trimble R8 GNSS',                'code' => 'GPS-R8',     'type' => 'GPS GNSS',         'brand' => 'Trimble',           'model' => 'R8s',                 'serial_number' => 'TRM-2021-55678',  'status' => Equipment::STATUS_ACTIVE,       'categorie' => 'outil_terrain',   'numero_inventaire' => 'MAT-2026-008', 'valeur_acquisition_ht' => 62000,  'fournisseur' => 'Trimble MENA',         'purchase_date' => '2021-05-20', 'heures' => 2400, 'reparation' => false],
            ['name' => 'Pénétromètre dynamique léger PDL',   'code' => 'PDL-01',     'type' => 'Pénétromètre',    'brand' => 'Pagani',            'model' => 'TG 63',               'serial_number' => 'PAG-2020-0044',   'status' => Equipment::STATUS_ACTIVE,       'categorie' => 'outil_terrain',   'numero_inventaire' => 'MAT-2026-009', 'valeur_acquisition_ht' => 9800,   'fournisseur' => 'PAGANI SRL',           'purchase_date' => '2020-03-15', 'heures' => 3800, 'reparation' => false],
            ['name' => 'Scissomètre de terrain VST',         'code' => 'SCISS-01',   'type' => 'Scissomètre',     'brand' => 'ELE International', 'model' => 'VST Field',           'serial_number' => 'ELE-2019-VST99',  'status' => Equipment::STATUS_ACTIVE,       'categorie' => 'outil_terrain',   'numero_inventaire' => 'MAT-2026-010', 'valeur_acquisition_ht' => 6200,   'fournisseur' => 'SOGETEC Maroc',        'purchase_date' => '2019-07-01', 'heures' => 2100, 'reparation' => false],
            ['name' => 'Balance électronique 30kg / 0.1g',   'code' => 'BAL-30',     'type' => 'Balance',          'brand' => 'Mettler Toledo',    'model' => 'ML 3002 E',           'serial_number' => 'MTL-2023-0091',   'status' => Equipment::STATUS_ACTIVE,       'categorie' => 'laboratoire',     'numero_inventaire' => 'MAT-2026-011', 'valeur_acquisition_ht' => 12500,  'fournisseur' => 'Mettler Toledo Maroc', 'purchase_date' => '2023-04-22', 'heures' => 950,  'reparation' => false],
            ['name' => 'Plaque de chargement 600mm',         'code' => 'PLC-600',    'type' => 'Plaque de chargement','brand' => 'Terratest',       'model' => 'PLT 600',             'serial_number' => 'TRT-2022-0188',   'status' => Equipment::STATUS_ACTIVE,       'categorie' => 'outil_terrain',   'numero_inventaire' => 'MAT-2026-012', 'valeur_acquisition_ht' => 15000,  'fournisseur' => 'Terratest GmbH',       'purchase_date' => '2022-08-10', 'heures' => 1700, 'reparation' => false],
            ['name' => 'Station météo terrain WS-3000',      'code' => 'METEO-01',   'type' => 'Station météo',    'brand' => 'Davis Instruments', 'model' => 'Vantage Pro2',        'serial_number' => 'DAV-2023-5591',   'status' => Equipment::STATUS_ACTIVE,       'categorie' => 'outil_terrain',   'numero_inventaire' => 'MAT-2026-013', 'valeur_acquisition_ht' => 4200,   'fournisseur' => 'Davis Instruments EU', 'purchase_date' => '2023-01-18', 'heures' => 500,  'reparation' => false],
            ['name' => "Préleveur d'eau automatique",        'code' => 'PRELEV-01',  'type' => 'Préleveur',       'brand' => 'Hach',              'model' => 'Sigma SD900',         'serial_number' => 'HCH-2021-4432',   'status' => Equipment::STATUS_MAINTENANCE,  'categorie' => 'appareil_mesure', 'numero_inventaire' => 'MAT-2026-014', 'valeur_acquisition_ht' => 18500,  'fournisseur' => 'Hach France',          'purchase_date' => '2021-10-05', 'heures' => 2200, 'reparation' => true],
            ['name' => "Caméra d'inspection de sondage",    'code' => 'CAM-SON',    'type' => 'Caméra',          'brand' => 'RIDGID',            'model' => 'SeeSnake Compact2',   'serial_number' => 'RID-2024-0012',   'status' => Equipment::STATUS_ACTIVE,       'categorie' => 'outil_terrain',   'numero_inventaire' => 'MAT-2026-015', 'valeur_acquisition_ht' => 22000,  'fournisseur' => 'RIDGID EMEA',          'purchase_date' => '2024-03-01', 'heures' => 320,  'reparation' => false],
        ];

        $hasMaterielAffectations = Schema::hasTable('materiel_affectations');

        foreach ($equipements as $i => $d) {
            $agence = $agences[$i % count($agences)];

            // Historique techniciens (3 entrées)
            $histoTechs = collect($techniciens)->slice($i % count($techniciens), 3)->values();
            $historique = [];
            foreach ($histoTechs as $j => $tech) {
                $debut = date('Y-m-d', strtotime('2024-01-01 +' . ($j * 60) . ' days'));
                $fin   = date('Y-m-d', strtotime($debut . ' +55 days'));
                $historique[] = ['user_id' => $tech->id, 'user_name' => $tech->name, 'date_debut' => $debut, 'date_fin' => $fin];
            }

            $eq = Equipment::firstOrCreate(
                ['numero_inventaire' => $d['numero_inventaire']],
                [
                    'name'                  => $d['name'],
                    'code'                  => $d['code'],
                    'type'                  => $d['type'],
                    'brand'                 => $d['brand'],
                    'model'                 => $d['model'],
                    'serial_number'         => $d['serial_number'],
                    'status'                => $d['status'],
                    'agency_id'             => $agence->id,
                    'location'              => $agence->name,
                    'purchase_date'         => $d['purchase_date'],
                    'categorie'             => $d['categorie'],
                    'valeur_acquisition_ht' => $d['valeur_acquisition_ht'],
                    'fournisseur'           => $d['fournisseur'],
                    'meta'                  => [
                        'heures_utilisation'     => $d['heures'],
                        'en_reparation'          => $d['reparation'],
                        'dernier_technicien_id'  => $techniciens[$i % count($techniciens)]->id,
                        'dernier_technicien'     => $techniciens[$i % count($techniciens)]->name,
                        'historique_techniciens' => $historique,
                    ],
                ]
            );

            if (! $eq->wasRecentlyCreated) {
                continue;
            }

            // Calibrations
            $nbCal = ($i % 2 === 0) ? 3 : 2;
            $calEntries = [
                ['date' => '2024-01-15', 'next' => '2025-01-15'],
                ['date' => '2024-07-20', 'next' => '2025-07-20'],
                ['date' => '2025-02-10', 'next' => '2026-02-10'],
            ];
            foreach (array_slice($calEntries, 0, $nbCal) as $cal) {
                Calibration::create([
                    'equipment_id'     => $eq->id,
                    'calibration_date' => $cal['date'],
                    'next_due_date'    => $cal['next'],
                    'provider'         => 'SONATRAC Métrologie',
                    'result'           => Calibration::RESULT_OK,
                    'notes'            => 'Étalonnage annuel — conforme ISO/IEC 17025.',
                ]);
            }

            // Affectation matériel
            if ($hasMaterielAffectations) {
                DB::table('materiel_affectations')->insert([
                    'equipment_id' => $eq->id,
                    'user_id'      => $techniciens[$i % count($techniciens)]->id,
                    'date_debut'   => '2026-01-01',
                    'date_fin'     => null,
                    'notes'        => 'Affectation initiale — seed démo',
                    'created_at'   => now(),
                    'updated_at'   => now(),
                ]);
            }
        }

        $this->command->info('MaterielDemoSeeder : ' . count($equipements) . ' équipements créés.');
    }
}
