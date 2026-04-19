<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('report_pdf_templates', function (Blueprint $table) {
            $table->json('layout_config')->nullable()->after('blade_view');
        });

        Schema::table('document_pdf_templates', function (Blueprint $table) {
            $table->json('layout_config')->nullable()->after('blade_view');
        });

        if (! DB::table('module_settings')->where('module_key', 'app_branding')->exists()) {
            DB::table('module_settings')->insert([
                'module_key' => 'app_branding',
                'settings' => json_encode([
                    'logo_public_path' => null,
                ]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('report_pdf_templates', function (Blueprint $table) {
            $table->dropColumn('layout_config');
        });

        Schema::table('document_pdf_templates', function (Blueprint $table) {
            $table->dropColumn('layout_config');
        });

        DB::table('module_settings')->where('module_key', 'app_branding')->delete();
    }
};
