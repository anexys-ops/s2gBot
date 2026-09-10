<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::table('module_settings')->where('module_key', 'fx_rates')->exists()) {
            return;
        }

        $now = now();
        DB::table('module_settings')->insert([
            'module_key' => 'fx_rates',
            'settings' => json_encode([
                'enabled' => true,
                'provider' => 'frankfurter',
                'base_currency' => 'MAD',
                'cache_ttl_minutes' => 360,
                'extra_currencies' => [],
                'fallback_rates' => [
                    'EUR' => 10.85,
                    'USD' => 10.02,
                    'GBP' => 12.50,
                    'CHF' => 11.40,
                    'CAD' => 7.35,
                    'SAR' => 2.67,
                    'AED' => 2.73,
                    'XOF' => 0.0165,
                    'XAF' => 0.0165,
                ],
            ]),
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    public function down(): void
    {
        DB::table('module_settings')->where('module_key', 'fx_rates')->delete();
    }
};
