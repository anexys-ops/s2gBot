<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sites', function (Blueprint $table) {
            $table->decimal('travel_fee_quote_ht', 12, 2)->default(0)->after('reference');
            $table->decimal('travel_fee_invoice_ht', 12, 2)->default(0)->after('travel_fee_quote_ht');
            $table->string('travel_fee_label')->nullable()->after('travel_fee_invoice_ht');
        });

        Schema::create('report_pdf_templates', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('name');
            $table->string('blade_view');
            $table->boolean('is_default')->default(false);
            $table->timestamps();
        });

        DB::table('report_pdf_templates')->insert([
            [
                'slug' => 'rapport-commande-classique',
                'name' => 'Rapport essais — classique',
                'blade_view' => 'reports.order',
                'is_default' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'slug' => 'rapport-commande-signature',
                'name' => 'Rapport essais — mise en page signature (même contenu, bloc signature si signé)',
                'blade_view' => 'reports.order',
                'is_default' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        Schema::table('reports', function (Blueprint $table) {
            $table->foreignId('pdf_template_id')->nullable()->after('order_id')->constrained('report_pdf_templates')->nullOnDelete();
            $table->json('form_data')->nullable()->after('filename');
            $table->timestamp('signed_at')->nullable()->after('form_data');
            $table->foreignId('signed_by_user_id')->nullable()->after('signed_at')->constrained('users')->nullOnDelete();
            $table->string('signer_name')->nullable()->after('signed_by_user_id');
            $table->text('signature_image_data')->nullable()->after('signer_name');
        });

        Schema::create('report_form_definitions', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('name');
            $table->string('service_key')->nullable();
            $table->json('fields');
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        DB::table('report_form_definitions')->insert([
            'slug' => 'prelevement-terrain',
            'name' => 'Prélèvement / conditions terrain',
            'service_key' => null,
            'fields' => json_encode([
                ['key' => 'meteo', 'label' => 'Météo', 'type' => 'text'],
                ['key' => 'temperature', 'label' => 'Température (°C)', 'type' => 'number'],
                ['key' => 'operateur', 'label' => 'Opérateur', 'type' => 'text'],
                ['key' => 'observations', 'label' => 'Observations', 'type' => 'textarea'],
            ]),
            'active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        Schema::table('quotes', function (Blueprint $table) {
            $table->decimal('travel_fee_ht', 12, 2)->default(0)->after('shipping_tva_rate');
            $table->decimal('travel_fee_tva_rate', 5, 2)->default(20)->after('travel_fee_ht');
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->decimal('travel_fee_ht', 12, 2)->default(0)->after('shipping_tva_rate');
            $table->decimal('travel_fee_tva_rate', 5, 2)->default(20)->after('travel_fee_ht');
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn(['travel_fee_ht', 'travel_fee_tva_rate']);
        });
        Schema::table('quotes', function (Blueprint $table) {
            $table->dropColumn(['travel_fee_ht', 'travel_fee_tva_rate']);
        });
        Schema::dropIfExists('report_form_definitions');
        Schema::table('reports', function (Blueprint $table) {
            $table->dropForeign(['pdf_template_id']);
            $table->dropForeign(['signed_by_user_id']);
            $table->dropColumn([
                'pdf_template_id', 'form_data', 'signed_at', 'signed_by_user_id',
                'signer_name', 'signature_image_data',
            ]);
        });
        Schema::dropIfExists('report_pdf_templates');
        Schema::table('sites', function (Blueprint $table) {
            $table->dropColumn(['travel_fee_quote_ht', 'travel_fee_invoice_ht', 'travel_fee_label']);
        });
    }
};
