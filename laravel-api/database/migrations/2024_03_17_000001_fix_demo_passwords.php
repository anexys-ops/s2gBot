<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

return new class extends Migration
{
    public function up(): void
    {
        $demo = [
            'admin@lab.local',
            'tech@lab.local',
            'client@demo.local',
        ];
        $correctHash = Hash::make('password');
        foreach ($demo as $email) {
            DB::table('users')->where('email', $email)->update(['password' => $correctHash]);
        }
    }

    public function down(): void
    {
        // Rien à annuler
    }
};
