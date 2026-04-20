<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('module_settings')) {
            return;
        }

        $now = now();
        $rows = [
            [
                'module_key' => 'invoice_reminders',
                'settings' => json_encode([
                    'enabled' => true,
                    'min_days_between' => 7,
                    'max_reminders_per_invoice' => 12,
                ]),
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'module_key' => 'accounting_export',
                'settings' => json_encode([
                    'account_client' => '411000',
                    'account_vat' => '445710',
                    'account_sales' => '701000',
                    'journal_code' => 'VT',
                ]),
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ];

        foreach ($rows as $row) {
            if (! DB::table('module_settings')->where('module_key', $row['module_key'])->exists()) {
                DB::table('module_settings')->insert($row);
            }
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('module_settings')) {
            return;
        }
        DB::table('module_settings')->whereIn('module_key', ['invoice_reminders', 'accounting_export'])->delete();
    }
};
