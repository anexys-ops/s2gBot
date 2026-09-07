<?php

namespace Database\Seeders;

use App\Models\Agency;
use Illuminate\Database\Seeder;

/**
 * 10 agences labo — grandes villes marocaines (idempotent sur code).
 * MHD = siège (Mohammedia).
 */
class MoroccoLabAgenciesSeeder extends Seeder
{
    public function run(): void
    {
        $agencies = [
            ['code' => 'MHD', 'name' => 'Siège — Mohammedia', 'city' => 'Mohammedia', 'is_siege' => true],
            ['code' => 'CAS', 'name' => 'Agence Casablanca', 'city' => 'Casablanca', 'is_siege' => false],
            ['code' => 'RAB', 'name' => 'Agence Rabat', 'city' => 'Rabat', 'is_siege' => false],
            ['code' => 'MAR', 'name' => 'Agence Marrakech', 'city' => 'Marrakech', 'is_siege' => false],
            ['code' => 'FES', 'name' => 'Agence Fès', 'city' => 'Fès', 'is_siege' => false],
            ['code' => 'TNG', 'name' => 'Agence Tanger', 'city' => 'Tanger', 'is_siege' => false],
            ['code' => 'AGA', 'name' => 'Agence Agadir', 'city' => 'Agadir', 'is_siege' => false],
            ['code' => 'MEK', 'name' => 'Agence Meknès', 'city' => 'Meknès', 'is_siege' => false],
            ['code' => 'OUJ', 'name' => 'Agence Oujda', 'city' => 'Oujda', 'is_siege' => false],
            ['code' => 'KEN', 'name' => 'Agence Kénitra', 'city' => 'Kénitra', 'is_siege' => false],
        ];

        foreach ($agencies as $row) {
            Agency::query()->updateOrCreate(
                ['code' => $row['code']],
                [
                    'name' => $row['name'],
                    'city' => $row['city'],
                    'client_id' => null,
                    'is_siege' => $row['is_siege'],
                    'is_headquarters' => false,
                    'active' => true,
                ],
            );
        }

        // Un seul siège
        Agency::query()->where('is_siege', true)->where('code', '!=', 'MHD')->update(['is_siege' => false]);

        Agency::query()->where('code', 'DEMO')->update(['active' => false]);

        $this->command?->info('MoroccoLabAgenciesSeeder OK : 10 agences marocaines (MHD siège).');
    }
}
