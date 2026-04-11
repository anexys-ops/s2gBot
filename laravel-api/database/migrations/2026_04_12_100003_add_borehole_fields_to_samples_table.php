<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('samples', function (Blueprint $table) {
            $table->foreignId('borehole_id')->nullable()->after('order_item_id')->constrained()->nullOnDelete();
            $table->decimal('depth_top_m', 8, 3)->nullable()->after('borehole_id');
            $table->decimal('depth_bottom_m', 8, 3)->nullable()->after('depth_top_m');
        });
    }

    public function down(): void
    {
        Schema::table('samples', function (Blueprint $table) {
            $table->dropForeign(['borehole_id']);
            $table->dropColumn(['borehole_id', 'depth_top_m', 'depth_bottom_m']);
        });
    }
};
