<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('ordre_mission_lignes')->where('statut', 'a_faire')->update(['statut' => 'planifie']);
        DB::table('ordre_mission_lignes')->where('statut', 'realise')->update(['statut' => 'attente_validation']);
    }

    public function down(): void
    {
        DB::table('ordre_mission_lignes')->where('statut', 'planifie')->update(['statut' => 'a_faire']);
        DB::table('ordre_mission_lignes')->where('statut', 'attente_validation')->update(['statut' => 'realise']);
    }
};
