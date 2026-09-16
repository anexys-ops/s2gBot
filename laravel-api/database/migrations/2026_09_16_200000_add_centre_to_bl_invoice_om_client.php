<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $tables = ['bons_livraison', 'invoices', 'ordres_mission', 'clients'];

        foreach ($tables as $table) {
            if (Schema::hasTable($table) && ! Schema::hasColumn($table, 'lab_centre_group_id')) {
                Schema::table($table, function (Blueprint $t) {
                    $t->foreignId('lab_centre_group_id')
                        ->nullable()
                        ->after('id')
                        ->constrained('lab_centre_groups')
                        ->nullOnDelete();
                });
            }
        }
    }

    public function down(): void
    {
        $tables = ['bons_livraison', 'invoices', 'ordres_mission', 'clients'];

        foreach ($tables as $table) {
            if (Schema::hasTable($table) && Schema::hasColumn($table, 'lab_centre_group_id')) {
                Schema::table($table, function (Blueprint $t) use ($table) {
                    $t->dropForeign(["{$table}_lab_centre_group_id_foreign"]);
                    $t->dropColumn('lab_centre_group_id');
                });
            }
        }
    }
};
