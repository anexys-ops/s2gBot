<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('samples', function (Blueprint $table) {
            if (! Schema::hasColumn('samples', 'reception_index')) {
                $table->unsignedSmallInteger('reception_index')->nullable()->after('transco_number')
                    ->comment('Numéro d\'échantillon dans le lot (ex. 2 sur 4)');
            }
            if (! Schema::hasColumn('samples', 'reception_batch_total')) {
                $table->unsignedSmallInteger('reception_batch_total')->nullable()->after('reception_index')
                    ->comment('Taille du lot de réception (ex. 4)');
            }
            if (! Schema::hasColumn('samples', 'cancelled_at')) {
                $table->timestamp('cancelled_at')->nullable()->after('received_at');
            }
            if (! Schema::hasColumn('samples', 'cancelled_by')) {
                $table->foreignId('cancelled_by')->nullable()->after('cancelled_at')
                    ->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('samples', 'cancellation_reason')) {
                $table->string('cancellation_reason', 500)->nullable()->after('cancelled_by');
            }
        });
    }

    public function down(): void
    {
        Schema::table('samples', function (Blueprint $table) {
            foreach (['cancellation_reason', 'cancelled_by', 'cancelled_at', 'reception_batch_total', 'reception_index'] as $col) {
                if (Schema::hasColumn('samples', $col)) {
                    if ($col === 'cancelled_by') {
                        try {
                            $table->dropForeign(['cancelled_by']);
                        } catch (\Throwable $e) {
                        }
                    }
                    $table->dropColumn($col);
                }
            }
        });
    }
};
