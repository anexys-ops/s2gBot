<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('document_pdf_templates', 'is_active')) {
            Schema::table('document_pdf_templates', function (Blueprint $table) {
                $table->boolean('is_active')->default(true)->after('is_default');
            });
        }

        $now = now();
        $presets = [
            [
                'document_type' => 'quote',
                'slug' => 'quote-sans-tva',
                'name' => 'Devis sans TVA',
                'blade_view' => 'pdf.quote',
                'is_default' => false,
                'is_active' => true,
                'layout_config' => json_encode([
                    'totals' => [
                        'show_total_ht' => true,
                        'show_total_tva' => false,
                        'show_total_ttc' => true,
                    ],
                    'lines' => [
                        'show_prices' => true,
                        'show_pu_pt_columns' => true,
                    ],
                ]),
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'document_type' => 'quote',
                'slug' => 'quote-sans-prix',
                'name' => 'Devis sans prix',
                'blade_view' => 'pdf.quote',
                'is_default' => false,
                'is_active' => true,
                'layout_config' => json_encode([
                    'totals' => [
                        'show_total_ht' => false,
                        'show_total_tva' => false,
                        'show_total_ttc' => false,
                    ],
                    'lines' => [
                        'show_prices' => false,
                        'show_pu_pt_columns' => false,
                    ],
                ]),
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'document_type' => 'invoice',
                'slug' => 'invoice-sans-tva',
                'name' => 'Facture sans TVA',
                'blade_view' => 'pdf.invoice',
                'is_default' => false,
                'is_active' => true,
                'layout_config' => json_encode([
                    'totals' => [
                        'show_total_ht' => true,
                        'show_total_tva' => false,
                        'show_total_ttc' => true,
                    ],
                    'lines' => [
                        'show_prices' => true,
                        'show_pu_pt_columns' => true,
                    ],
                ]),
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'document_type' => 'invoice',
                'slug' => 'invoice-sans-prix',
                'name' => 'Facture sans prix',
                'blade_view' => 'pdf.invoice',
                'is_default' => false,
                'is_active' => true,
                'layout_config' => json_encode([
                    'totals' => [
                        'show_total_ht' => false,
                        'show_total_tva' => false,
                        'show_total_ttc' => false,
                    ],
                    'lines' => [
                        'show_prices' => false,
                        'show_pu_pt_columns' => false,
                    ],
                ]),
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ];

        foreach ($presets as $preset) {
            if (! DB::table('document_pdf_templates')->where('slug', $preset['slug'])->exists()) {
                DB::table('document_pdf_templates')->insert($preset);
            }
        }
    }

    public function down(): void
    {
        DB::table('document_pdf_templates')->whereIn('slug', [
            'quote-sans-tva',
            'quote-sans-prix',
            'invoice-sans-tva',
            'invoice-sans-prix',
        ])->delete();

        Schema::table('document_pdf_templates', function (Blueprint $table) {
            $table->dropColumn('is_active');
        });
    }
};
