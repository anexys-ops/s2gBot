<?php

namespace Database\Seeders;

use App\Models\Catalogue\Article;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Remet tout le périmètre multi-agence en mode « siège » :
 * - employés internes sans agency_id (vision globale)
 * - clients sans restriction d'agence
 * - articles catalogue en multi-site
 */
class LabAgencySiegeResetSeeder extends Seeder
{
    public function run(): void
    {
        $internalRoles = User::ROLES_INTERNAL;

        User::query()
            ->whereIn('role', $internalRoles)
            ->update(['agency_id' => null]);

        DB::table('client_lab_agency')->truncate();
        DB::table('article_lab_agency')->truncate();

        if (DB::getSchemaBuilder()->hasColumn('ref_articles', 'is_multi_site')) {
            Article::query()->update(['is_multi_site' => true]);
        }

        $this->command?->info('LabAgencySiegeResetSeeder OK : staff siège, clients globaux, produits multi-site.');
    }
}
