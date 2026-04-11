<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('commercial_offerings', function (Blueprint $table) {
            $table->id();
            $table->string('code', 64)->nullable()->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('kind', 16)->default('service'); // product | service
            $table->string('unit', 32)->nullable();
            $table->decimal('purchase_price_ht', 12, 2)->default(0);
            $table->decimal('sale_price_ht', 12, 2)->default(0);
            $table->decimal('default_tva_rate', 5, 2)->default(20);
            $table->decimal('stock_quantity', 14, 3)->default(0);
            $table->boolean('track_stock')->default(false);
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::table('quote_lines', function (Blueprint $table) {
            $table->foreignId('commercial_offering_id')->nullable()->after('quote_id')->constrained('commercial_offerings')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('quote_lines', function (Blueprint $table) {
            $table->dropForeign(['commercial_offering_id']);
            $table->dropColumn('commercial_offering_id');
        });
        Schema::dropIfExists('commercial_offerings');
    }
};
