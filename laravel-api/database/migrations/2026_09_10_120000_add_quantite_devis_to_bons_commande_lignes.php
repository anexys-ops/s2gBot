<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('bons_commande_lignes')) {
            return;
        }

        Schema::table('bons_commande_lignes', function (Blueprint $table) {
            if (! Schema::hasColumn('bons_commande_lignes', 'quantite_devis')) {
                $table->decimal('quantite_devis', 12, 3)->nullable()->after('quantite');
            }
        });

        if (! Schema::hasColumn('bons_commande_lignes', 'quantite_devis')) {
            return;
        }

        $bonCommandes = DB::table('bons_commande')->whereNotNull('quote_id')->orderBy('id')->get(['id', 'quote_id']);
        foreach ($bonCommandes as $bc) {
            $quoteLines = DB::table('quote_lines')
                ->where('quote_id', $bc->quote_id)
                ->orderBy('id')
                ->get(['quantity']);
            $bcLignes = DB::table('bons_commande_lignes')
                ->where('bon_commande_id', $bc->id)
                ->orderBy('ordre')
                ->orderBy('id')
                ->get(['id', 'quantite']);
            foreach ($bcLignes as $index => $ligne) {
                $quoteQty = isset($quoteLines[$index]) ? (float) $quoteLines[$index]->quantity : (float) $ligne->quantite;
                DB::table('bons_commande_lignes')
                    ->where('id', $ligne->id)
                    ->update(['quantite_devis' => $quoteQty]);
            }
        }

        DB::table('bons_commande_lignes')
            ->whereNull('quantite_devis')
            ->update(['quantite_devis' => DB::raw('quantite')]);
    }

    public function down(): void
    {
        if (! Schema::hasTable('bons_commande_lignes') || ! Schema::hasColumn('bons_commande_lignes', 'quantite_devis')) {
            return;
        }

        Schema::table('bons_commande_lignes', function (Blueprint $table) {
            $table->dropColumn('quantite_devis');
        });
    }
};
