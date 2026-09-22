<?php

use App\Models\Sample;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('samples', function (Blueprint $table) {
            $table->timestamp('prepared_by_task_at')->nullable()->after('task_id');
        });

        DB::table('samples')
            ->whereNotNull('task_id')
            ->where('status', Sample::STATUS_RECEPTIONNE)
            ->update([
                'status' => Sample::STATUS_EN_TRANSIT,
                'prepared_by_task_at' => now(),
            ]);
    }

    public function down(): void
    {
        DB::table('samples')
            ->whereNotNull('prepared_by_task_at')
            ->where('status', Sample::STATUS_EN_TRANSIT)
            ->update(['status' => Sample::STATUS_RECEPTIONNE]);

        Schema::table('samples', function (Blueprint $table) {
            $table->dropColumn('prepared_by_task_at');
        });
    }
};
