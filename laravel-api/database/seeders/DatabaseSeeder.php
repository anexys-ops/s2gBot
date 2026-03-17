<?php

namespace Database\Seeders;

use App\Models\Client;
use App\Models\TestType;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::create([
            'name' => 'Admin Lab',
            'email' => 'admin@lab.local',
            'password' => Hash::make('password'),
            'role' => User::ROLE_LAB_ADMIN,
        ]);

        $tech = User::create([
            'name' => 'Technicien',
            'email' => 'tech@lab.local',
            'password' => Hash::make('password'),
            'role' => User::ROLE_LAB_TECHNICIAN,
        ]);

        $client = Client::create([
            'name' => 'Client Demo',
            'address' => '1 rue Example',
            'email' => 'contact@client-demo.fr',
            'phone' => '01 23 45 67 89',
            'siret' => '12345678901234',
        ]);

        $clientUser = User::create([
            'name' => 'Contact Client',
            'email' => 'client@demo.local',
            'password' => Hash::make('password'),
            'role' => User::ROLE_CLIENT,
            'client_id' => $client->id,
        ]);

        $t1 = TestType::create([
            'name' => 'Résistance à la compression béton',
            'norm' => 'NF EN 12390-3',
            'unit' => 'MPa',
            'unit_price' => 85.00,
            'thresholds' => ['min' => 25, 'max' => 50],
        ]);
        $t1->params()->createMany([
            ['name' => 'Résistance caractéristique', 'unit' => 'MPa', 'expected_type' => 'numeric'],
            ['name' => 'Date essai', 'unit' => null, 'expected_type' => 'date'],
        ]);

        $t2 = TestType::create([
            'name' => 'Analyse granulométrique',
            'norm' => 'NF EN 933-1',
            'unit' => null,
            'unit_price' => 120.00,
            'thresholds' => null,
        ]);
        $t2->params()->createMany([
            ['name' => 'Module de finesse', 'unit' => null, 'expected_type' => 'numeric'],
            ['name' => 'Refus cumulé 0.063 mm', 'unit' => '%', 'expected_type' => 'numeric'],
        ]);

        // Exemples supplémentaires : sols, équivalent de sable
        $t3 = TestType::create([
            'name' => 'Indice CBR (California Bearing Ratio)',
            'norm' => 'NF EN 13286-47',
            'unit' => '%',
            'unit_price' => 95.00,
            'thresholds' => ['min' => 5, 'max' => 100],
        ]);
        $t3->params()->createMany([
            ['name' => 'CBR à 2.5 mm', 'unit' => '%', 'expected_type' => 'numeric'],
            ['name' => 'CBR à 5 mm', 'unit' => '%', 'expected_type' => 'numeric'],
        ]);

        $t4 = TestType::create([
            'name' => 'Equivalent de sable',
            'norm' => 'NF EN 933-8',
            'unit' => '%',
            'unit_price' => 65.00,
            'thresholds' => ['min' => 60],
        ]);
        $t4->params()->createMany([
            ['name' => 'SE', 'unit' => '%', 'expected_type' => 'numeric'],
        ]);

        $t5 = TestType::create([
            'name' => 'Teneur en eau (sols)',
            'norm' => 'NF EN ISO 17892-1',
            'unit' => '%',
            'unit_price' => 45.00,
            'thresholds' => null,
        ]);
        $t5->params()->createMany([
            ['name' => 'W', 'unit' => '%', 'expected_type' => 'numeric'],
        ]);

        $this->call(MailTemplateSeeder::class);
    }
}
