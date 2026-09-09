<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $exists = DB::table('document_pdf_templates')
            ->where('document_type', 'expense_report')
            ->exists();

        if ($exists) {
            return;
        }

        DB::table('document_pdf_templates')->insert([
            'document_type' => 'expense_report',
            'slug'          => 'expense-report-classique',
            'name'          => 'Note de frais classique',
            'blade_view'    => 'pdf.expense_report',
            'is_default'    => true,
            'is_active'     => true,
            'created_at'    => now(),
            'updated_at'    => now(),
        ]);
    }

    public function down(): void
    {
        DB::table('document_pdf_templates')
            ->where('document_type', 'expense_report')
            ->delete();
    }
};
