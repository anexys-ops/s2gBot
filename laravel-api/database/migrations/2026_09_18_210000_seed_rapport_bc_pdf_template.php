<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::table('document_pdf_templates')->where('document_type', 'rapport_bc')->doesntExist()) {
            DB::table('document_pdf_templates')->insert([
                'document_type' => 'rapport_bc',
                'slug'          => 'rapport-bc-defaut',
                'name'          => 'Rapport de mission (défaut)',
                'blade_view'    => 'pdf.rapport_bc',
                'is_default'    => true,
                'is_active'     => true,
                'layout_config' => json_encode([]),
                'created_at'    => now(),
                'updated_at'    => now(),
            ]);
        }
    }

    public function down(): void
    {
        DB::table('document_pdf_templates')
            ->where('document_type', 'rapport_bc')
            ->where('slug', 'rapport-bc-defaut')
            ->delete();
    }
};
