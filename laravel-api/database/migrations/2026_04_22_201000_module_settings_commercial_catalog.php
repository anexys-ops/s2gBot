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

        if (DB::table('module_settings')->where('module_key', 'commercial_catalog')->exists()) {
            return;
        }

        DB::table('module_settings')->insert([
            'module_key' => 'commercial_catalog',
            'settings' => json_encode([
                'link_equipment_to_products' => true,
                'show_equipment_on_quote_pdf' => true,
            ]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        if (Schema::hasTable('module_settings')) {
            DB::table('module_settings')->where('module_key', 'commercial_catalog')->delete();
        }
    }
};

