<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('quote_lines')) {
            return;
        }
        if (! Schema::hasColumn('quote_lines', 'unite')) {
            Schema::table('quote_lines', function (Blueprint $table) {
                $table->string('unite', 64)->nullable()->after('description');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('quote_lines')) {
            return;
        }
        if (Schema::hasColumn('quote_lines', 'unite')) {
            Schema::table('quote_lines', function (Blueprint $table) {
                $table->dropColumn('unite');
            });
        }
    }
};
