<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            if (! Schema::hasColumn('invoices', 'notes')) {
                $table->text('notes')->nullable()->after('status');
            }
            if (! Schema::hasColumn('invoices', 'next_reminder_date')) {
                $table->date('next_reminder_date')->nullable()->after('last_reminder_sent_at');
            }
            if (! Schema::hasColumn('invoices', 'reminder_notes')) {
                $table->text('reminder_notes')->nullable()->after('next_reminder_date');
            }
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $cols = ['notes', 'next_reminder_date', 'reminder_notes'];
            foreach ($cols as $col) {
                if (Schema::hasColumn('invoices', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
