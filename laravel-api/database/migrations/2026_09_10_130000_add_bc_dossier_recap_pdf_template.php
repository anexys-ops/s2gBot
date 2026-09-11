<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::table('document_pdf_templates')->where('slug', 'bc-recap-dossier')->exists()) {
            return;
        }

        $now = now();
        DB::table('document_pdf_templates')->insert([
            'document_type' => 'purchase_order',
            'slug' => 'bc-recap-dossier',
            'name' => 'BC — Récap dossier',
            'blade_view' => 'pdf.purchase_order_dossier_recap',
            'is_default' => false,
            'is_active' => true,
            'layout_config' => json_encode([
                'totals' => ['show_total_ht' => true, 'show_total_tva' => true, 'show_total_ttc' => true],
                'lines' => ['show_prices' => true, 'show_pu_pt_columns' => true],
                'meta' => [
                    'show_client_name' => true,
                    'show_dossier_reference' => true,
                    'show_linked_quote' => true,
                    'show_affaire' => true,
                ],
            ]),
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    public function down(): void
    {
        DB::table('document_pdf_templates')->where('slug', 'bc-recap-dossier')->delete();
    }
};
