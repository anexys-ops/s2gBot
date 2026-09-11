<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('expense_reports', function (Blueprint $table) {
            $table->text('private_notes')->nullable()->after('notes');
            $table->decimal('advance_amount', 10, 2)->nullable()->after('private_notes')
                ->comment('Acompte déjà versé');
        });

        Schema::table('expense_lines', function (Blueprint $table) {
            $table->boolean('is_validated')->default(false)->after('receipt_filename');
        });
    }

    public function down(): void
    {
        Schema::table('expense_reports', function (Blueprint $table) {
            $table->dropColumn(['private_notes', 'advance_amount']);
        });

        Schema::table('expense_lines', function (Blueprint $table) {
            $table->dropColumn('is_validated');
        });
    }
};
