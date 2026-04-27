<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void {
        // Fix mojibake: UTF-8 bytes stored as Latin-1
        // Convert: binary → latin1 → utf8mb4 to recover correct chars
        $tables = [
            ['table' => 'clients', 'cols' => ['name', 'address', 'city']],
            ['table' => 'client_contacts', 'cols' => ['nom', 'prenom']],
            ['table' => 'sites', 'cols' => ['name', 'address']],
        ];
        foreach ($tables as $t) {
            foreach ($t['cols'] as $col) {
                // Only touch rows that contain the signature mojibake pattern (0xC3 followed by high byte)
                DB::statement("UPDATE `{$t['table']}` SET `{$col}` = CONVERT(BINARY CONVERT(`{$col}` USING latin1) USING utf8mb4) WHERE `{$col}` REGEXP '[Ã-Ã¿]'");
            }
        }
    }
    public function down(): void {}
};
