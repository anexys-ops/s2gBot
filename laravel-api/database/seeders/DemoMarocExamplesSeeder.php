<?php

namespace Database\Seeders;

use App\Models\Borehole;
use App\Models\Client;
use App\Models\ClientAddress;
use App\Models\DocumentPdfTemplate;
use App\Models\Invoice;
use App\Models\InvoiceLine;
use App\Models\Mission;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Quote;
use App\Models\QuoteLine;
use App\Models\Site;
use App\Models\TestType;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Exemples Maroc : CA facturé 354 000 DH (TVA 20 %), devis / factures multi-lignes,
 * deux chantiers Casablanca avec missions + forages GPS (carte dans l’UI).
 */
class DemoMarocExamplesSeeder extends Seeder
{
    public const SITE_PORT_REF = 'SEED-CASA-PORT-ANFA';

    public const SITE_GREEN_REF = 'SEED-CASA-GREEN-BC';

    public function run(): void
    {
        if (Site::where('reference', self::SITE_PORT_REF)->exists()) {
            return;
        }

        $admin = User::where('role', User::ROLE_LAB_ADMIN)->first();
        $tech = User::where('role', User::ROLE_LAB_TECHNICIAN)->first();
        if (! $admin) {
            $this->command?->warn('DemoMarocExamplesSeeder : admin absent — exécutez DatabaseSeeder d’abord.');

            return;
        }

        $actorId = $tech?->id ?? $admin->id;

        $clientMa = Client::firstOrCreate(
            ['siret' => 'MA-ICE-ATLASBTP-001'],
            [
                'name' => 'Atlas BTP & Projets (MA)',
                'address' => 'Angle bd Zerktouni / rue Tahar Sebti, 20100 Casablanca',
                'email' => 'projets@atlas-btp-ma.ma',
                'phone' => '+212 522 00 11 22',
            ],
        );

        $addrMa = ClientAddress::firstOrCreate(
            ['client_id' => $clientMa->id, 'type' => ClientAddress::TYPE_BILLING, 'line1' => 'Siège Casa'],
            [
                'label' => 'Siège',
                'postal_code' => '20100',
                'city' => 'Casablanca',
                'country' => 'MA',
                'is_default' => true,
            ],
        );

        $pdfQuote = DocumentPdfTemplate::where('document_type', 'quote')->where('is_default', true)->first();
        $pdfInvoice = DocumentPdfTemplate::where('document_type', 'invoice')->where('is_default', true)->first();

        // Chantier 1 — extension port (plusieurs lignes métier dans devis / facture)
        $sitePort = Site::create([
            'client_id' => $clientMa->id,
            'name' => 'Extension portuaire Anfa — phase 2 (géotechnique)',
            'address' => 'Zone portuaire Anfa, 20250 Casablanca',
            'reference' => self::SITE_PORT_REF,
            'latitude' => 33.6054,
            'longitude' => -7.6318,
            'travel_fee_quote_ht' => 2400,
            'travel_fee_invoice_ht' => 2400,
            'travel_fee_label' => 'Mise en place plateau + déplacements port (DH HT)',
            'meta' => [
                'indicateurs' => ['zone' => 'Grand Casa', 'type_projet' => 'Infrastructure portuaire'],
                'champs_perso' => ['maitre_ouvrage' => 'ANP — démo seed'],
            ],
        ]);

        // Chantier 2 — résidence (autre projet, multi-lignes devis)
        $siteGreen = Site::create([
            'client_id' => $clientMa->id,
            'name' => 'Résidence Casa Green — tours B & C',
            'address' => 'Quartier Californie, 20460 Casablanca',
            'reference' => self::SITE_GREEN_REF,
            'latitude' => 33.5731,
            'longitude' => -7.5898,
            'travel_fee_quote_ht' => 1800,
            'travel_fee_invoice_ht' => 1800,
            'travel_fee_label' => 'Forfait déplacement terrain Casa (DH HT)',
            'meta' => [
                'indicateurs' => ['lots' => 'B+C', 'surface_dalle' => '4200 m²'],
                'champs_perso' => ['promoteur' => 'Green Living Démo'],
            ],
        ]);

        $missionPort = Mission::create([
            'site_id' => $sitePort->id,
            'reference' => 'MIS-MA-PORT-01',
            'title' => 'Reconnaissance sols — quai et digue',
            'mission_status' => 'g3',
            'maitre_ouvrage_name' => 'Agence portuaire (démo)',
            'maitre_ouvrage_email' => 'chantier.port@demo.ma',
            'maitre_ouvrage_phone' => '+212 661 00 22 33',
            'notes' => 'Seed : 2 forages GPS pour carte chantier.',
        ]);

        Borehole::create([
            'mission_id' => $missionPort->id,
            'code' => 'F-P1',
            'latitude' => 33.6059,
            'longitude' => -7.6312,
            'ground_level_m' => 4.2,
            'notes' => 'Forage démo — tête de quai.',
        ]);
        Borehole::create([
            'mission_id' => $missionPort->id,
            'code' => 'F-P2',
            'latitude' => 33.6048,
            'longitude' => -7.6326,
            'ground_level_m' => 3.95,
            'notes' => 'Forage démo — zone digue.',
        ]);

        $missionGreen = Mission::create([
            'site_id' => $siteGreen->id,
            'reference' => 'MIS-MA-GREEN-01',
            'title' => 'Étude géotechnique tours B+C',
            'mission_status' => 'g2',
            'maitre_ouvrage_name' => 'Promoteur Casa Green (démo)',
            'maitre_ouvrage_email' => 'tech@casagreen.demo',
            'maitre_ouvrage_phone' => '+212 662 11 44 55',
            'notes' => 'Seed : forages sur emprise tours.',
        ]);

        Borehole::create([
            'mission_id' => $missionGreen->id,
            'code' => 'TG-B1',
            'latitude' => 33.5736,
            'longitude' => -7.5892,
            'ground_level_m' => 41.0,
            'notes' => 'Tour B — axe nord.',
        ]);
        Borehole::create([
            'mission_id' => $missionGreen->id,
            'code' => 'TG-C1',
            'latitude' => 33.5726,
            'longitude' => -7.5904,
            'ground_level_m' => 40.8,
            'notes' => 'Tour C — axe sud.',
        ]);

        $tva = 20.0;
        // 354 000 DH TTC = 295 000 DH HT à 20 % TVA
        $linesPortHt = [
            ['desc' => 'Mission reconnaissance géotechnique portuaire — 18 sondages & essais in situ', 'ht' => 95000],
            ['desc' => 'Essais laboratoire — identification sols, oedomètres, cisaillement UU', 'ht' => 78000],
            ['desc' => 'Rapport géotechnique G2/G3 + annexes numériques (plans, coupes)', 'ht' => 62000],
            ['desc' => 'Assistance technique MOE — réunions et reprises de notes (forfait)', 'ht' => 45000],
            ['desc' => 'Dossier administratif, archivage et remise sous format réglementaire', 'ht' => 15000],
        ];
        $totalHtPort = array_sum(array_column($linesPortHt, 'ht'));
        $totalTtcPort = round($totalHtPort * (1 + $tva / 100), 2);

        $quotePort = Quote::create([
            'number' => 'DEV-SEED-MA-PORT-354K',
            'client_id' => $clientMa->id,
            'site_id' => $sitePort->id,
            'quote_date' => now()->subWeeks(3),
            'valid_until' => now()->addMonths(2),
            'site_delivery_date' => now()->addMonths(5),
            'amount_ht' => $totalHtPort,
            'amount_ttc' => $totalTtcPort,
            'tva_rate' => $tva,
            'discount_percent' => 0,
            'discount_amount' => 0,
            'shipping_amount_ht' => 0,
            'shipping_tva_rate' => $tva,
            'travel_fee_ht' => 0,
            'travel_fee_tva_rate' => $tva,
            'billing_address_id' => $addrMa->id,
            'delivery_address_id' => null,
            'pdf_template_id' => $pdfQuote?->id,
            'status' => Quote::STATUS_SIGNED,
            'notes' => 'Exemple seed Maroc — devis multi-lignes, CA cible 354 000 DH TTC sur la facture associée.',
            'meta' => [
                'devise' => 'MAD',
                'ca_cible_dh_ttc' => 354000,
                'projet' => 'Extension port Anfa phase 2',
            ],
        ]);

        foreach ($linesPortHt as $row) {
            QuoteLine::create([
                'quote_id' => $quotePort->id,
                'description' => $row['desc'],
                'quantity' => 1,
                'unit_price' => $row['ht'],
                'tva_rate' => $tva,
                'discount_percent' => 0,
                'total' => $row['ht'],
            ]);
        }

        // Devis second chantier — plusieurs lignes (montant différent)
        $linesGreenHt = [
            ['desc' => 'Étude géotechnique G1 — 8 sondages légers', 'ht' => 42000],
            ['desc' => 'Calculs fondations superficielles et recommandations phasage', 'ht' => 28000],
            ['desc' => 'Suivi compactage remblais (3 passages)', 'ht' => 18500],
            ['desc' => 'Rapport synthèse bilingue FR/AR (démo)', 'ht' => 15000],
        ];
        $htGreen = array_sum(array_column($linesGreenHt, 'ht'));
        $ttcGreen = round($htGreen * (1 + $tva / 100), 2);

        $quoteGreen = Quote::create([
            'number' => 'DEV-SEED-MA-GREEN-BC',
            'client_id' => $clientMa->id,
            'site_id' => $siteGreen->id,
            'quote_date' => now()->subDays(12),
            'valid_until' => now()->addMonth(),
            'site_delivery_date' => now()->addMonths(3),
            'amount_ht' => $htGreen,
            'amount_ttc' => $ttcGreen,
            'tva_rate' => $tva,
            'discount_percent' => 0,
            'discount_amount' => 0,
            'shipping_amount_ht' => 0,
            'shipping_tva_rate' => $tva,
            'travel_fee_ht' => 0,
            'travel_fee_tva_rate' => $tva,
            'billing_address_id' => $addrMa->id,
            'pdf_template_id' => $pdfQuote?->id,
            'status' => Quote::STATUS_SENT,
            'notes' => 'Exemple seed — résidence Casa Green, 4 lignes (frais déplacement sur fiche chantier).',
            'meta' => ['devise' => 'MAD', 'lots' => 'B+C'],
        ]);

        foreach ($linesGreenHt as $row) {
            QuoteLine::create([
                'quote_id' => $quoteGreen->id,
                'description' => $row['desc'],
                'quantity' => 1,
                'unit_price' => $row['ht'],
                'tva_rate' => $tva,
                'discount_percent' => 0,
                'total' => $row['ht'],
            ]);
        }

        $orderPort = Order::create([
            'reference' => 'SEED-MA-CMD-PORT-354',
            'client_id' => $clientMa->id,
            'site_id' => $sitePort->id,
            'user_id' => $actorId,
            'status' => Order::STATUS_COMPLETED,
            'order_date' => now()->subWeeks(5),
            'delivery_date' => now()->subWeek(),
            'notes' => 'Commande seed — liée facture 354 000 DH TTC.',
        ]);

        $tCbr = TestType::where('name', 'like', '%CBR%')->first();
        if ($tCbr) {
            OrderItem::create([
                'order_id' => $orderPort->id,
                'test_type_id' => $tCbr->id,
                'quantity' => 4,
            ]);
        }

        $invoicePort = Invoice::create([
            'number' => 'FAC-SEED-MA-354000',
            'client_id' => $clientMa->id,
            'invoice_date' => now()->subWeeks(1),
            'due_date' => now()->addMonth(),
            'order_date' => $orderPort->order_date,
            'site_delivery_date' => $orderPort->delivery_date,
            'amount_ht' => $totalHtPort,
            'amount_ttc' => $totalTtcPort,
            'tva_rate' => $tva,
            'billing_address_id' => $addrMa->id,
            'pdf_template_id' => $pdfInvoice?->id,
            'status' => Invoice::STATUS_PAID,
            'meta' => [
                'devise' => 'MAD',
                'ca_dh_ttc' => 354000,
                'libelle' => 'Exemple CA Maroc — 354 000 DH TTC (5 lignes)',
            ],
        ]);

        foreach ($linesPortHt as $row) {
            InvoiceLine::create([
                'invoice_id' => $invoicePort->id,
                'description' => $row['desc'],
                'quantity' => 1,
                'unit_price' => $row['ht'],
                'tva_rate' => $tva,
                'discount_percent' => 0,
                'total' => $row['ht'],
                'order_item_id' => null,
            ]);
        }

        $invoicePort->orders()->syncWithoutDetaching([$orderPort->id]);

        $this->command?->info('DemoMarocExamplesSeeder : client Atlas BTP, 2 chantiers Casa (GPS), devis multi-lignes, facture FAC-SEED-MA-354000 = 354 000 DH TTC.');
    }
}
