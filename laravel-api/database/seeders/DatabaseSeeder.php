<?php

namespace Database\Seeders;

use App\Models\Client;
use App\Models\TestType;
use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        User::firstOrCreate(
            ['email' => 'admin@lab.local'],
            [
                'name' => 'Admin Lab',
                'password' => 'password',
                'role' => User::ROLE_LAB_ADMIN,
            ],
        );

        User::firstOrCreate(
            ['email' => 'tech@lab.local'],
            [
                'name' => 'Technicien',
                'password' => 'password',
                'role' => User::ROLE_LAB_TECHNICIAN,
            ],
        );

        $client = Client::firstOrCreate(
            ['siret' => '12345678901234'],
            [
                'name' => 'Client Demo',
                'address' => '1 rue Example',
                'email' => 'contact@client-demo.fr',
                'phone' => '01 23 45 67 89',
            ],
        );

        User::firstOrCreate(
            ['email' => 'client@demo.local'],
            [
                'name' => 'Contact Client',
                'password' => 'password',
                'role' => User::ROLE_CLIENT,
                'client_id' => $client->id,
            ],
        );

        $t1 = TestType::firstOrCreate(
            ['name' => 'Résistance à la compression béton'],
            [
                'norm' => 'NF EN 12390-3',
                'unit' => 'MPa',
                'unit_price' => 85.00,
                'thresholds' => ['min' => 25, 'max' => 50],
            ],
        );
        if ($t1->wasRecentlyCreated) {
            $t1->params()->createMany([
                ['name' => 'Résistance caractéristique', 'unit' => 'MPa', 'expected_type' => 'numeric'],
                ['name' => 'Date essai', 'unit' => null, 'expected_type' => 'date'],
            ]);
        }

        $t2 = TestType::firstOrCreate(
            ['name' => 'Analyse granulométrique'],
            [
                'norm' => 'NF EN 933-1',
                'unit' => null,
                'unit_price' => 120.00,
                'thresholds' => null,
            ],
        );
        if ($t2->wasRecentlyCreated) {
            $t2->params()->createMany([
                ['name' => 'Module de finesse', 'unit' => null, 'expected_type' => 'numeric'],
                ['name' => 'Refus cumulé 0.063 mm', 'unit' => '%', 'expected_type' => 'numeric'],
            ]);
        }

        $t3 = TestType::firstOrCreate(
            ['name' => 'Indice CBR (California Bearing Ratio)'],
            [
                'norm' => 'NF EN 13286-47',
                'unit' => '%',
                'unit_price' => 95.00,
                'thresholds' => ['min' => 5, 'max' => 100],
            ],
        );
        if ($t3->wasRecentlyCreated) {
            $t3->params()->createMany([
                ['name' => 'CBR à 2.5 mm', 'unit' => '%', 'expected_type' => 'numeric'],
                ['name' => 'CBR à 5 mm', 'unit' => '%', 'expected_type' => 'numeric'],
            ]);
        }

        $t4 = TestType::firstOrCreate(
            ['name' => 'Equivalent de sable'],
            [
                'norm' => 'NF EN 933-8',
                'unit' => '%',
                'unit_price' => 65.00,
                'thresholds' => ['min' => 60],
            ],
        );
        if ($t4->wasRecentlyCreated) {
            $t4->params()->createMany([
                ['name' => 'SE', 'unit' => '%', 'expected_type' => 'numeric'],
            ]);
        }

        $t5 = TestType::firstOrCreate(
            ['name' => 'Teneur en eau (sols)'],
            [
                'norm' => 'NF EN ISO 17892-1',
                'unit' => '%',
                'unit_price' => 45.00,
                'thresholds' => null,
            ],
        );
        if ($t5->wasRecentlyCreated) {
            $t5->params()->createMany([
                ['name' => 'W', 'unit' => '%', 'expected_type' => 'numeric'],
            ]);
        }

        $this->call(MailTemplateSeeder::class);
        $this->call(ClientsProLabSeeder::class);
        $this->call(CatalogueProLabSeeder::class);
        $this->call(CommercialOfferingSeeder::class);
        $this->call(DemoEssaisGraphiquesSeeder::class);
        $this->call(DemoFullDatasetSeeder::class);
        $this->call(DemoMarocExamplesSeeder::class);
        $this->call(MaterielDemoSeeder::class);

        /** Groupes d'accès PROLAB + rattachement agence (utilisateurs @labo.ma) — voir BDC-147. */
        $this->call(ProlabGroupsAgenciesSeeder::class);

        /** v1.2.0 — LIMS géotechnique (40 essais, 20 matériels, 10 prélèvements, 4 templates). */
        $this->call(GeotechniqueV12Seeder::class);

        /**
         * v1.2.0 — Jeu démo complet : 5 dossiers, 5 chantiers, 10 devis,
         * 5 BC, 3 factures, 5 OdM (terrain/labo/ingé), planning techniciens,
         * 10 échantillons FOLD, 2 notes de frais.
         * Idempotent — relancer le seeder ne duplique pas.
         */
        $this->call(FullDemoDataSeeder::class);
    }
}
