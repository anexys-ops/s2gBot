<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->seedCommercialDocumentTemplates();
        $this->migrateReportTemplates();
    }

    public function down(): void
    {
        DB::table('document_pdf_templates')->whereIn('document_type', ['purchase_order', 'delivery_note'])->delete();
        DB::table('document_pdf_templates')->where('document_type', 'report')->delete();
    }

    private function seedCommercialDocumentTemplates(): void
    {
        $now = now();
        $presets = [
            [
                'document_type' => 'purchase_order',
                'slug' => 'bc-classique',
                'name' => 'Bon de commande classique',
                'blade_view' => 'pdf.purchase_order',
                'is_default' => true,
                'is_active' => true,
                'layout_config' => json_encode([
                    'totals' => ['show_total_ht' => true, 'show_total_tva' => true, 'show_total_ttc' => true],
                    'lines' => ['show_prices' => true, 'show_pu_pt_columns' => true],
                ]),
            ],
            [
                'document_type' => 'purchase_order',
                'slug' => 'bc-sans-tva',
                'name' => 'Bon de commande sans TVA',
                'blade_view' => 'pdf.purchase_order',
                'is_default' => false,
                'is_active' => true,
                'layout_config' => json_encode([
                    'totals' => ['show_total_ht' => true, 'show_total_tva' => false, 'show_total_ttc' => true],
                    'lines' => ['show_prices' => true, 'show_pu_pt_columns' => true],
                ]),
            ],
            [
                'document_type' => 'purchase_order',
                'slug' => 'bc-sans-prix',
                'name' => 'Bon de commande sans prix',
                'blade_view' => 'pdf.purchase_order',
                'is_default' => false,
                'is_active' => true,
                'layout_config' => json_encode([
                    'totals' => ['show_total_ht' => false, 'show_total_tva' => false, 'show_total_ttc' => false],
                    'lines' => ['show_prices' => false, 'show_pu_pt_columns' => false],
                ]),
            ],
            [
                'document_type' => 'delivery_note',
                'slug' => 'bl-classique',
                'name' => 'Bon de livraison classique',
                'blade_view' => 'pdf.delivery_note',
                'is_default' => true,
                'is_active' => true,
                'layout_config' => json_encode([
                    'totals' => ['show_total_ht' => true, 'show_total_tva' => true, 'show_total_ttc' => true],
                    'lines' => ['show_prices' => true, 'show_pu_pt_columns' => true],
                ]),
            ],
            [
                'document_type' => 'delivery_note',
                'slug' => 'bl-sans-prix',
                'name' => 'Bon de livraison sans prix',
                'blade_view' => 'pdf.delivery_note',
                'is_default' => false,
                'is_active' => true,
                'layout_config' => json_encode([
                    'totals' => ['show_total_ht' => false, 'show_total_tva' => false, 'show_total_ttc' => false],
                    'lines' => ['show_prices' => false, 'show_pu_pt_columns' => false],
                ]),
            ],
        ];

        foreach ($presets as $preset) {
            if (! DB::table('document_pdf_templates')->where('slug', $preset['slug'])->exists()) {
                DB::table('document_pdf_templates')->insert(array_merge($preset, [
                    'created_at' => $now,
                    'updated_at' => $now,
                ]));
            }
        }
    }

    private function migrateReportTemplates(): void
    {
        if (! Schema::hasTable('report_pdf_templates')) {
            return;
        }

        if (DB::table('document_pdf_templates')->where('document_type', 'report')->exists()) {
            return;
        }

        $now = now();
        $idMap = [];

        foreach (DB::table('report_pdf_templates')->orderBy('id')->get() as $row) {
            $layout = property_exists($row, 'layout_config') ? $row->layout_config : null;
            $newId = DB::table('document_pdf_templates')->insertGetId([
                'document_type' => 'report',
                'slug' => $row->slug,
                'name' => $row->name,
                'blade_view' => $row->blade_view,
                'is_default' => (bool) $row->is_default,
                'is_active' => true,
                'layout_config' => $layout,
                'created_at' => $row->created_at ?? $now,
                'updated_at' => $row->updated_at ?? $now,
            ]);
            $idMap[(int) $row->id] = $newId;
        }

        if ($idMap === []) {
            return;
        }

        foreach ($idMap as $oldId => $newId) {
            DB::table('reports')->where('pdf_template_id', $oldId)->update(['pdf_template_id' => $newId]);
        }

        Schema::table('reports', function (Blueprint $table) {
            $table->dropForeign(['pdf_template_id']);
        });

        Schema::table('reports', function (Blueprint $table) {
            $table->foreign('pdf_template_id')
                ->references('id')
                ->on('document_pdf_templates')
                ->nullOnDelete();
        });
    }
};
