<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('module_settings')) {
            return;
        }

        $key = 'equipment_calibration_alerts';
        if (DB::table('module_settings')->where('module_key', $key)->exists()) {
            return;
        }

        $now = now();
        DB::table('module_settings')->insert([
            'module_key' => $key,
            'settings' => json_encode([
                'enabled' => true,
                'within_days' => 30,
            ]),
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    public function down(): void
    {
        if (! Schema::hasTable('module_settings')) {
            return;
        }
        DB::table('module_settings')->where('module_key', 'equipment_calibration_alerts')->delete();
    }
};
