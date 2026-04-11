<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_pdf_templates', function (Blueprint $table) {
            $table->id();
            $table->string('document_type', 32);
            $table->string('slug')->unique();
            $table->string('name');
            $table->string('blade_view');
            $table->boolean('is_default')->default(false);
            $table->timestamps();
        });

        DB::table('document_pdf_templates')->insert([
            [
                'document_type' => 'quote',
                'slug' => 'quote-classique',
                'name' => 'Devis classique',
                'blade_view' => 'pdf.quote',
                'is_default' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'document_type' => 'quote',
                'slug' => 'quote-detail-tva',
                'name' => 'Devis détaillé (TVA par ligne)',
                'blade_view' => 'pdf.quote_detailed',
                'is_default' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'document_type' => 'invoice',
                'slug' => 'invoice-classique',
                'name' => 'Facture classique',
                'blade_view' => 'pdf.invoice',
                'is_default' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'document_type' => 'invoice',
                'slug' => 'invoice-detail-tva',
                'name' => 'Facture détaillée (TVA par ligne)',
                'blade_view' => 'pdf.invoice_detailed',
                'is_default' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        Schema::create('client_addresses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->constrained()->cascadeOnDelete();
            $table->string('type', 32);
            $table->string('label')->nullable();
            $table->string('line1');
            $table->string('line2')->nullable();
            $table->string('postal_code', 32)->nullable();
            $table->string('city')->nullable();
            $table->string('country', 8)->default('FR');
            $table->boolean('is_default')->default(false);
            $table->timestamps();
        });

        Schema::create('attachments', function (Blueprint $table) {
            $table->id();
            $table->morphs('attachable');
            $table->string('path');
            $table->string('original_filename');
            $table->string('mime_type')->nullable();
            $table->unsignedBigInteger('size_bytes')->default(0);
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('commercial_document_links', function (Blueprint $table) {
            $table->id();
            $table->string('source_type');
            $table->unsignedBigInteger('source_id');
            $table->string('target_type');
            $table->unsignedBigInteger('target_id');
            $table->string('relation', 64)->default('related');
            $table->timestamps();
            $table->index(['source_type', 'source_id']);
            $table->index(['target_type', 'target_id']);
        });

        Schema::table('quote_lines', function (Blueprint $table) {
            $table->decimal('tva_rate', 5, 2)->default(20)->after('unit_price');
            $table->decimal('discount_percent', 5, 2)->default(0)->after('tva_rate');
        });

        Schema::table('invoice_lines', function (Blueprint $table) {
            $table->decimal('tva_rate', 5, 2)->default(20)->after('unit_price');
            $table->decimal('discount_percent', 5, 2)->default(0)->after('tva_rate');
        });

        Schema::table('quotes', function (Blueprint $table) {
            $table->date('order_date')->nullable()->after('quote_date');
            $table->date('site_delivery_date')->nullable()->after('order_date');
            $table->decimal('discount_percent', 5, 2)->default(0)->after('tva_rate');
            $table->decimal('discount_amount', 12, 2)->default(0)->after('discount_percent');
            $table->decimal('shipping_amount_ht', 12, 2)->default(0)->after('discount_amount');
            $table->decimal('shipping_tva_rate', 5, 2)->default(20)->after('shipping_amount_ht');
            $table->foreignId('billing_address_id')->nullable()->after('site_id')->constrained('client_addresses')->nullOnDelete();
            $table->foreignId('delivery_address_id')->nullable()->after('billing_address_id')->constrained('client_addresses')->nullOnDelete();
            $table->foreignId('pdf_template_id')->nullable()->after('delivery_address_id')->constrained('document_pdf_templates')->nullOnDelete();
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->date('order_date')->nullable()->after('invoice_date');
            $table->date('site_delivery_date')->nullable()->after('order_date');
            $table->decimal('discount_percent', 5, 2)->default(0)->after('tva_rate');
            $table->decimal('discount_amount', 12, 2)->default(0)->after('discount_percent');
            $table->decimal('shipping_amount_ht', 12, 2)->default(0)->after('discount_amount');
            $table->decimal('shipping_tva_rate', 5, 2)->default(20)->after('shipping_amount_ht');
            $table->foreignId('billing_address_id')->nullable()->after('client_id')->constrained('client_addresses')->nullOnDelete();
            $table->foreignId('delivery_address_id')->nullable()->after('billing_address_id')->constrained('client_addresses')->nullOnDelete();
            $table->foreignId('pdf_template_id')->nullable()->after('delivery_address_id')->constrained('document_pdf_templates')->nullOnDelete();
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->date('delivery_date')->nullable()->after('order_date');
            $table->foreignId('billing_address_id')->nullable()->after('site_id')->constrained('client_addresses')->nullOnDelete();
            $table->foreignId('delivery_address_id')->nullable()->after('billing_address_id')->constrained('client_addresses')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropForeign(['billing_address_id']);
            $table->dropForeign(['delivery_address_id']);
            $table->dropColumn(['delivery_date', 'billing_address_id', 'delivery_address_id']);
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->dropForeign(['billing_address_id']);
            $table->dropForeign(['delivery_address_id']);
            $table->dropForeign(['pdf_template_id']);
            $table->dropColumn([
                'order_date', 'site_delivery_date', 'discount_percent', 'discount_amount',
                'shipping_amount_ht', 'shipping_tva_rate', 'billing_address_id', 'delivery_address_id', 'pdf_template_id',
            ]);
        });

        Schema::table('quotes', function (Blueprint $table) {
            $table->dropForeign(['billing_address_id']);
            $table->dropForeign(['delivery_address_id']);
            $table->dropForeign(['pdf_template_id']);
            $table->dropColumn([
                'order_date', 'site_delivery_date', 'discount_percent', 'discount_amount',
                'shipping_amount_ht', 'shipping_tva_rate', 'billing_address_id', 'delivery_address_id', 'pdf_template_id',
            ]);
        });

        Schema::table('invoice_lines', function (Blueprint $table) {
            $table->dropColumn(['tva_rate', 'discount_percent']);
        });

        Schema::table('quote_lines', function (Blueprint $table) {
            $table->dropColumn(['tva_rate', 'discount_percent']);
        });

        Schema::dropIfExists('commercial_document_links');
        Schema::dropIfExists('attachments');
        Schema::dropIfExists('client_addresses');
        Schema::dropIfExists('document_pdf_templates');
    }
};
