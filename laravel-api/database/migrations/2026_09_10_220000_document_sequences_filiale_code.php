<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('document_sequences')) {
            return;
        }

        if (! Schema::hasColumn('document_sequences', 'agency_code')) {
            Schema::table('document_sequences', function (Blueprint $table) {
                $table->string('agency_code', 10)->default('HQ')->after('year');
            });
        }

        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'sqlite') {
            DB::statement('DROP INDEX IF EXISTS document_sequences_type_year_unique');
            DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS document_sequences_type_year_agency_code_unique ON document_sequences (type, year, agency_code)');
        } elseif ($driver === 'mysql') {
            $indexes = collect(DB::select('SHOW INDEX FROM document_sequences'))
                ->pluck('Key_name')
                ->unique();
            if ($indexes->contains('document_sequences_type_year_unique')) {
                Schema::table('document_sequences', function (Blueprint $table) {
                    $table->dropUnique('document_sequences_type_year_unique');
                });
            }
            if (! $indexes->contains('document_sequences_type_year_agency_code_unique')) {
                Schema::table('document_sequences', function (Blueprint $table) {
                    $table->unique(['type', 'year', 'agency_code'], 'document_sequences_type_year_agency_code_unique');
                });
            }
        } elseif ($driver === 'pgsql') {
            DB::statement('DROP INDEX IF EXISTS document_sequences_type_year_unique');
            DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS document_sequences_type_year_agency_code_unique ON document_sequences (type, year, agency_code)');
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('document_sequences') || ! Schema::hasColumn('document_sequences', 'agency_code')) {
            return;
        }

        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'sqlite') {
            DB::statement('DROP INDEX IF EXISTS document_sequences_type_year_agency_code_unique');
            DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS document_sequences_type_year_unique ON document_sequences (type, year)');
        } elseif ($driver === 'mysql') {
            Schema::table('document_sequences', function (Blueprint $table) {
                $table->dropUnique('document_sequences_type_year_agency_code_unique');
                $table->unique(['type', 'year']);
            });
        } elseif ($driver === 'pgsql') {
            DB::statement('DROP INDEX IF EXISTS document_sequences_type_year_agency_code_unique');
            DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS document_sequences_type_year_unique ON document_sequences (type, year)');
        }

        Schema::table('document_sequences', function (Blueprint $table) {
            $table->dropColumn('agency_code');
        });
    }
};
