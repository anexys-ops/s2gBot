<?php

namespace Database\Seeders;

use App\Models\Agency;
use Illuminate\Database\Seeder;

/**
 * AgenciesSeeder — crée les agences de base (siège Mohamedia + agence démo).
 *
 * Idempotent : firstOrCreate sur `code`.
 */
class AgenciesSeeder extends Seeder
{
    public function run(): void
    {
        // Siège Mohamedia
        Agency::firstOrCreate(
            ['code' => 'MHD'],
            [
                'name'     => 'Siège — Mohamedia',
                'city'     => 'Mohamedia',
                'is_siege' => true,
                'active'   => true,
            ]
        );

        // Agence démo
        Agency::firstOrCreate(
            ['code' => 'DEMO'],
            [
                'name'     => 'Agence Démo',
                'city'     => 'Casablanca',
                'is_siege' => false,
                'active'   => true,
            ]
        );

        $this->command?->info('AgenciesSeeder OK : agences MHD + DEMO créées ou déjà présentes.');
    }
}
