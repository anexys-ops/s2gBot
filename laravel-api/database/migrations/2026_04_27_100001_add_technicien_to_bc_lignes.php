<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('bons_commande_lignes', function (Blueprint $table) {
            if (!Schema::hasColumn('bons_commande_lignes', 'technicien_id')) {
                $table->foreignId('technicien_id')->nullable()->after('date_fin_prevue')
                    ->constrained('users')->nullOnDelete();
            }
            if (!Schema::hasColumn('bons_commande_lignes', 'date_livraison')) {
                $table->date('date_livraison')->nullable()->after('technicien_id');
            }
            if (!Schema::hasColumn('bons_commande_lignes', 'notes_ligne')) {
                $table->string('notes_ligne', 500)->nullable()->after('date_livraison');
            }
        });
    }
    public function down(): void {
        Schema::table('bons_commande_lignes', function (Blueprint $table) {
            $table->dropConstrainedForeignId('technicien_id');
            $table->dropColumn(['date_livraison', 'notes_ligne']);
        });
    }
};
