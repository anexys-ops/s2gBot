<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::table('document_pdf_templates')->where('slug', 'planning-terrain-classique')->exists()) {
            return;
        }

        DB::table('document_pdf_templates')->insert([
            'document_type' => 'terrain_planning',
            'slug' => 'planning-terrain-classique',
            'name' => 'Programme terrain classique',
            'blade_view' => 'pdf.terrain_planning',
            'is_default' => true,
            'is_active' => true,
            'layout_config' => json_encode([
                'header' => ['show_logo' => true],
                'planning' => [
                    'show_technician' => true,
                    'show_start_date' => true,
                    'show_end_date' => true,
                    'show_client' => true,
                    'show_order' => true,
                    'show_task' => true,
                    'show_quantity' => true,
                    'show_notes' => true,
                ],
            ]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        DB::table('document_pdf_templates')->where('slug', 'planning-terrain-classique')->delete();
    }
};
