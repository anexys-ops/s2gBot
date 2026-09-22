<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mission_tasks', function (Blueprint $table) {
            $table->json('pv_numbers')->nullable()->after('notes');
            $table->string('quantity_unit', 24)->nullable()->after('pv_numbers');
            $table->unsignedInteger('quantity_count')->nullable()->after('quantity_unit');
            $table->timestamp('reception_generated_at')->nullable()->after('quantity_count');
        });
    }

    public function down(): void
    {
        Schema::table('mission_tasks', function (Blueprint $table) {
            $table->dropColumn(['pv_numbers', 'quantity_unit', 'quantity_count', 'reception_generated_at']);
        });
    }
};
