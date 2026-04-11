<?php

namespace Database\Seeders;

use App\Models\CommercialOffering;
use Illuminate\Database\Seeder;

class CommercialOfferingSeeder extends Seeder
{
    public function run(): void
    {
        $rows = [
            [
                'code' => 'GEO-RECO-G2',
                'name' => 'Étude géotechnique G2 (reconnaissance)',
                'description' => 'Rapport de synthèse, plans de localisation, corrélation sondages.',
                'kind' => CommercialOffering::KIND_SERVICE,
                'unit' => 'forfait',
                'purchase_price_ht' => 420,
                'sale_price_ht' => 1850,
                'default_tva_rate' => 20,
                'stock_quantity' => 0,
                'track_stock' => false,
            ],
            [
                'code' => 'SOND-CAROTTE',
                'name' => 'Sondage carotté — au mètre linéaire',
                'description' => 'Mise en œuvre, carottage, remblaiage provisoire.',
                'kind' => CommercialOffering::KIND_SERVICE,
                'unit' => 'ml',
                'purchase_price_ht' => 35,
                'sale_price_ht' => 95,
                'default_tva_rate' => 20,
                'stock_quantity' => 0,
                'track_stock' => false,
            ],
            [
                'code' => 'ESS-COMP-B',
                'name' => 'Essai compression béton cylindre',
                'description' => 'NF EN 12390-3 — fourniture éprouvette en option.',
                'kind' => CommercialOffering::KIND_SERVICE,
                'unit' => 'u',
                'purchase_price_ht' => 28,
                'sale_price_ht' => 85,
                'default_tva_rate' => 20,
                'stock_quantity' => 0,
                'track_stock' => false,
            ],
            [
                'code' => 'CONS-EPR-16',
                'name' => 'Consommables éprouvettes Ø16 (lot 6)',
                'description' => 'Coffret plastique + joint.',
                'kind' => CommercialOffering::KIND_PRODUCT,
                'unit' => 'lot',
                'purchase_price_ht' => 12.5,
                'sale_price_ht' => 28,
                'default_tva_rate' => 20,
                'stock_quantity' => 120,
                'track_stock' => true,
            ],
            [
                'code' => 'DEPL-STD',
                'name' => 'Forfait déplacement standard (rayon 50 km)',
                'description' => 'Véhicule utilitaire, 2 techniciens, demi-journée.',
                'kind' => CommercialOffering::KIND_SERVICE,
                'unit' => 'forfait',
                'purchase_price_ht' => 45,
                'sale_price_ht' => 180,
                'default_tva_rate' => 20,
                'stock_quantity' => 0,
                'track_stock' => false,
            ],
        ];

        foreach ($rows as $r) {
            CommercialOffering::firstOrCreate(
                ['code' => $r['code']],
                array_merge($r, ['active' => true])
            );
        }
    }
}
