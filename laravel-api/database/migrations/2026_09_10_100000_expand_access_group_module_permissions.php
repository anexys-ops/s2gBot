<?php

use App\Support\PermissionCatalog;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $rows = DB::table('access_groups')->get(['id', 'permissions']);

        foreach ($rows as $row) {
            $raw = json_decode((string) $row->permissions, true);
            if (! is_array($raw)) {
                continue;
            }

            $expanded = PermissionCatalog::expandEffective($raw);

            DB::table('access_groups')->where('id', $row->id)->update([
                'permissions' => json_encode($expanded),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        // Non réversible proprement : les modules.* ajoutés ne sont pas distingués des originaux.
    }
};
