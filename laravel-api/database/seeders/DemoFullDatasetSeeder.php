<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Models\Borehole;
use App\Models\Client;
use App\Models\ClientAddress;
use App\Models\DocumentPdfTemplate;
use App\Models\Invoice;
use App\Models\InvoiceLine;
use App\Models\LabCadrage;
use App\Models\LithologyLayer;
use App\Models\Mission;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Quote;
use App\Models\QuoteLine;
use App\Models\Report;
use App\Models\ReportPdfTemplate;
use App\Models\Sample;
use App\Models\Site;
use App\Models\TestResult;
use App\Models\TestType;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Jeu de données d’exemple couvrant CRM, chantiers, missions/forages, commandes, résultats, rapports, devis et factures.
 * Idempotent : une exécution repérée par la référence de chantier {@see self::SITE_MARKER_REF}.
 */
class DemoFullDatasetSeeder extends Seeder
{
    public const SITE_MARKER_REF = 'SEED-DEMO-ZAC-IRIS';

    public function run(): void
    {
        if (Site::where('reference', self::SITE_MARKER_REF)->exists()) {
            return;
        }

        $admin = User::where('role', User::ROLE_LAB_ADMIN)->first();
        $tech = User::where('role', User::ROLE_LAB_TECHNICIAN)->first();
        $demoClient = Client::where('siret', '12345678901234')->first();

        if (! $admin || ! $demoClient) {
            $this->command?->warn('DemoFullDatasetSeeder : admin ou client démo absent — exécutez DatabaseSeeder de base d’abord.');

            return;
        }

        $actorId = $tech?->id ?? $admin->id;

        $clientBt = Client::firstOrCreate(
            ['siret' => '11122233344441'],
            [
                'name' => 'BTP Alpes & Rhône',
                'address' => '45 avenue du Général Leclerc, 69007 Lyon',
                'email' => 'administration@btp-alpes-rhone.fr',
                'phone' => '04 72 00 11 22',
            ],
        );

        $clientErp = Client::firstOrCreate(
            ['siret' => '22233344455552'],
            [
                'name' => 'ERP Construction Métropole',
                'address' => '8 quai Victor Augagneur, 69003 Lyon',
                'email' => 'compta@erp-construction.fr',
                'phone' => '04 78 55 66 77',
            ],
        );

        $addrDemoBill = ClientAddress::firstOrCreate(
            ['client_id' => $demoClient->id, 'type' => ClientAddress::TYPE_BILLING, 'line1' => '1 rue Example'],
            [
                'label' => 'Siège',
                'postal_code' => '69001',
                'city' => 'Lyon',
                'country' => 'FR',
                'is_default' => true,
            ],
        );

        ClientAddress::firstOrCreate(
            ['client_id' => $demoClient->id, 'type' => ClientAddress::TYPE_DELIVERY, 'line1' => 'ZAC Les Iris, bât. B'],
            [
                'label' => 'Chantier ZAC',
                'postal_code' => '69100',
                'city' => 'Villeurbanne',
                'country' => 'FR',
                'is_default' => false,
            ],
        );

        $addrBtBill = ClientAddress::firstOrCreate(
            ['client_id' => $clientBt->id, 'type' => ClientAddress::TYPE_BILLING, 'line1' => '45 avenue du Général Leclerc'],
            [
                'label' => 'Siège social',
                'postal_code' => '69007',
                'city' => 'Lyon',
                'country' => 'FR',
                'is_default' => true,
            ],
        );

        $pdfQuote = DocumentPdfTemplate::where('document_type', 'quote')->where('is_default', true)->first();
        $pdfInvoice = DocumentPdfTemplate::where('document_type', 'invoice')->where('is_default', true)->first();

        $hqDemo = (int) Agency::query()->where('client_id', $demoClient->id)->where('is_headquarters', true)->value('id');
        $hqBt = (int) Agency::query()->where('client_id', $clientBt->id)->where('is_headquarters', true)->value('id');
        $hqErp = (int) Agency::query()->where('client_id', $clientErp->id)->where('is_headquarters', true)->value('id');

        $siteZac = Site::create([
            'client_id' => $demoClient->id,
            'agency_id' => $hqDemo,
            'name' => 'ZAC Les Iris — bureaux et commerces',
            'address' => 'ZAC Les Iris, 69100 Villeurbanne',
            'reference' => self::SITE_MARKER_REF,
            'latitude' => 45.7712,
            'longitude' => 4.8906,
            'travel_fee_quote_ht' => 180,
            'travel_fee_invoice_ht' => 180,
            'travel_fee_label' => 'Frais déplacement géotechnique (A/R)',
        ]);

        $siteHsl = Site::firstOrCreate(
            ['reference' => 'SEED-HSL-LOT3'],
            [
                'client_id' => $clientBt->id,
                'agency_id' => $hqBt,
                'name' => 'Ligne nouvelle — Lot géotechnique 3',
                'address' => 'Secteur Valence — Romans, Drôme',
                'latitude' => 44.9333,
                'longitude' => 4.8900,
                'travel_fee_quote_ht' => 420,
                'travel_fee_invoice_ht' => 420,
                'travel_fee_label' => 'Mission longue durée — hébergement inclus',
            ],
        );

        $siteCas = Site::firstOrCreate(
            ['reference' => 'SEED-CASERNE-09'],
            [
                'client_id' => $clientErp->id,
                'agency_id' => $hqErp,
                'name' => 'Réhabilitation caserne historique',
                'address' => 'Place d’Armes, 09000 Foix',
                'latitude' => 42.9687,
                'longitude' => 1.6069,
                'travel_fee_quote_ht' => 95,
                'travel_fee_invoice_ht' => 95,
                'travel_fee_label' => 'Déplacement Ariège',
            ],
        );

        foreach ([$siteHsl, $siteCas] as $s) {
            if ($s->agency_id === null) {
                $hid = (int) Agency::query()->where('client_id', $s->client_id)->where('is_headquarters', true)->value('id');
                if ($hid) {
                    $s->update(['agency_id' => $hid]);
                }
            }
        }

        User::firstOrCreate(
            ['email' => 'chantier@demo.local'],
            [
                'name' => 'Contact chantier ZAC',
                'password' => 'password',
                'role' => User::ROLE_SITE_CONTACT,
                'client_id' => $demoClient->id,
                'site_id' => $siteZac->id,
            ],
        );

        $tBeton = TestType::where('name', 'like', '%compression%')->first();
        $tEau = TestType::where('name', 'like', '%Teneur en eau%')->first();
        $tCbr = TestType::where('name', 'like', '%CBR%')->first();

        $mission = Mission::create([
            'site_id' => $siteZac->id,
            'reference' => 'MIS-SEED-ZAC-01',
            'title' => 'Reconnaissance géotechnique — ZAC Les Iris',
            'mission_status' => 'g3',
            'maitre_ouvrage_name' => 'SEM Villeurbanne Développement',
            'maitre_ouvrage_email' => 'projets@sem-villeurbanne.fr',
            'maitre_ouvrage_phone' => '04 78 12 34 56',
            'notes' => 'Phase G3 : campagne de sondages et prélèvements. Données exemples pour tests UI.',
        ]);

        $bh1 = Borehole::create([
            'mission_id' => $mission->id,
            'code' => 'SC1',
            'latitude' => 45.7710,
            'longitude' => 4.8908,
            'ground_level_m' => 168.450,
            'notes' => 'Sondage carotté — refus à 8,2 m.',
        ]);

        $bh2 = Borehole::create([
            'mission_id' => $mission->id,
            'code' => 'P1',
            'latitude' => 45.7715,
            'longitude' => 4.8902,
            'ground_level_m' => 168.520,
            'notes' => 'Pénétromètre statique — arrêt charge limite.',
        ]);

        LithologyLayer::create([
            'borehole_id' => $bh1->id,
            'depth_from_m' => 0,
            'depth_to_m' => 1.2,
            'description' => 'Remblai anthropique — graves sableuses',
            'rqd' => null,
            'sort_order' => 0,
        ]);
        LithologyLayer::create([
            'borehole_id' => $bh1->id,
            'depth_from_m' => 1.2,
            'depth_to_m' => 4.5,
            'description' => 'Limons sableux bruns, plastiques',
            'rqd' => null,
            'sort_order' => 1,
        ]);
        LithologyLayer::create([
            'borehole_id' => $bh1->id,
            'depth_from_m' => 4.5,
            'depth_to_m' => 8.2,
            'description' => 'Marnes argileuses semi-résistantes',
            'rqd' => 72.5,
            'sort_order' => 2,
        ]);

        $orderTerrain = Order::create([
            'reference' => 'SEED-CHANT-ZAC-01',
            'client_id' => $demoClient->id,
            'agency_id' => $hqDemo,
            'site_id' => $siteZac->id,
            'user_id' => $actorId,
            'status' => Order::STATUS_IN_PROGRESS,
            'order_date' => now()->subWeeks(2),
            'delivery_date' => now()->addWeek(),
            'notes' => 'Dossier en cours — prélèvements liés aux forages SC1 / P1.',
        ]);

        if ($tBeton) {
            $oi = OrderItem::create([
                'order_id' => $orderTerrain->id,
                'test_type_id' => $tBeton->id,
                'quantity' => 3,
            ]);
            Sample::create([
                'order_item_id' => $oi->id,
                'borehole_id' => $bh1->id,
                'reference' => 'ECH-SC1-2.5',
                'status' => Sample::STATUS_RECEIVED,
                'received_at' => now()->subDays(3),
                'depth_top_m' => 2.0,
                'depth_bottom_m' => 2.5,
                'notes' => 'Carotte limon sous couche de remblai.',
            ]);
            Sample::create([
                'order_item_id' => $oi->id,
                'borehole_id' => $bh2->id,
                'reference' => 'ECH-P1-4.0',
                'status' => Sample::STATUS_IN_PROGRESS,
                'received_at' => now()->subDay(),
                'depth_top_m' => 3.5,
                'depth_bottom_m' => 4.0,
            ]);
        }

        if ($tEau) {
            $oiEau = OrderItem::create([
                'order_id' => $orderTerrain->id,
                'test_type_id' => $tEau->id,
                'quantity' => 2,
            ]);
            $s = Sample::create([
                'order_item_id' => $oiEau->id,
                'borehole_id' => $bh1->id,
                'reference' => 'ECH-W-SC1-3',
                'status' => Sample::STATUS_TESTED,
                'received_at' => now()->subDays(2),
                'depth_top_m' => 3.0,
                'depth_bottom_m' => 3.3,
            ]);
            $paramW = $tEau->params()->where('name', 'W')->first();
            if ($paramW) {
                TestResult::create([
                    'sample_id' => $s->id,
                    'test_type_param_id' => $paramW->id,
                    'value' => '18.4',
                ]);
            }
        }

        $orderRapport = Order::create([
            'reference' => 'SEED-RAPPORT-REVIEW',
            'client_id' => $demoClient->id,
            'agency_id' => $hqDemo,
            'site_id' => $siteZac->id,
            'user_id' => $actorId,
            'status' => Order::STATUS_COMPLETED,
            'order_date' => now()->subWeeks(4),
            'delivery_date' => now()->subWeek(),
            'notes' => 'Jeu démo — rapport en attente de validation.',
        ]);

        $tplReport = ReportPdfTemplate::where('is_default', true)->first();
        Report::create([
            'order_id' => $orderRapport->id,
            'pdf_template_id' => $tplReport?->id,
            'file_path' => 'reports/seed/rapport_seed_review.pdf',
            'filename' => 'Rapport_SEED-RAPPORT-REVIEW.pdf',
            'generated_at' => now()->subDays(5),
            'form_data' => [
                'meteo' => 'Couvert, bruine légère',
                'temperature' => 14,
                'operateur' => $tech?->name ?? 'Technicien démo',
                'observations' => 'Essais laboratoire conformes au programme. Données fictives.',
            ],
            'review_status' => Report::REVIEW_PENDING,
        ]);

        $orderFacture = Order::create([
            'reference' => 'SEED-FACTURE-LIE',
            'client_id' => $clientBt->id,
            'agency_id' => $hqBt,
            'site_id' => $siteHsl->id,
            'user_id' => $actorId,
            'status' => Order::STATUS_COMPLETED,
            'order_date' => now()->subMonths(1),
            'delivery_date' => now()->subWeeks(3),
            'notes' => 'Commande clôturée — utilisée pour lien facture démo.',
        ]);

        if ($tCbr) {
            OrderItem::create([
                'order_id' => $orderFacture->id,
                'test_type_id' => $tCbr->id,
                'quantity' => 6,
            ]);
        }

        $lineHt1 = 1200.00;
        $lineHt2 = 850.50;
        $tva = 20.0;
        $totalHt = $lineHt1 + $lineHt2;
        $totalTtc = round($totalHt * (1 + $tva / 100), 2);

        $quote = Quote::create([
            'number' => 'DEV-SEED-2026-001',
            'client_id' => $clientBt->id,
            'agency_id' => $hqBt,
            'site_id' => $siteHsl->id,
            'quote_date' => now()->subWeeks(2),
            'valid_until' => now()->addMonth(),
            'order_date' => null,
            'site_delivery_date' => now()->addMonths(2),
            'amount_ht' => $totalHt,
            'amount_ttc' => $totalTtc,
            'tva_rate' => $tva,
            'discount_percent' => 0,
            'discount_amount' => 0,
            'shipping_amount_ht' => 0,
            'shipping_tva_rate' => $tva,
            'travel_fee_ht' => 420,
            'travel_fee_tva_rate' => $tva,
            'billing_address_id' => null,
            'delivery_address_id' => null,
            'pdf_template_id' => $pdfQuote?->id,
            'status' => Quote::STATUS_SENT,
            'notes' => 'Devis démo — prestations géotechniques ligne nouvelle.',
        ]);

        QuoteLine::create([
            'quote_id' => $quote->id,
            'description' => 'Mission reconnaissance — 12 sondages + 4 essais CBR',
            'quantity' => 1,
            'unit_price' => $lineHt1,
            'tva_rate' => $tva,
            'discount_percent' => 0,
            'total' => $lineHt1,
        ]);
        QuoteLine::create([
            'quote_id' => $quote->id,
            'description' => 'Rapport géotechnique G2 / G3 (relecture MOE incluse)',
            'quantity' => 1,
            'unit_price' => $lineHt2,
            'tva_rate' => $tva,
            'discount_percent' => 0,
            'total' => $lineHt2,
        ]);

        Quote::firstOrCreate(
            ['number' => 'DEV-SEED-2026-002'],
            [
                'client_id' => $clientErp->id,
                'agency_id' => $hqErp,
                'site_id' => $siteCas->id,
                'quote_date' => now()->subDays(5),
                'valid_until' => now()->addWeeks(3),
                'amount_ht' => 2400,
                'amount_ttc' => 2880,
                'tva_rate' => $tva,
                'status' => Quote::STATUS_DRAFT,
                'notes' => 'Brouillon — étude de sol bâtiment réhabilité.',
                'pdf_template_id' => $pdfQuote?->id,
            ],
        );

        $invHt = 2050.00;
        $invTtc = round($invHt * (1 + $tva / 100), 2);
        $invoice = Invoice::create([
            'number' => 'FAC-SEED-2026-001',
            'client_id' => $clientBt->id,
            'agency_id' => $hqBt,
            'invoice_date' => now()->subWeeks(2),
            'due_date' => now()->addWeeks(2),
            'order_date' => $orderFacture->order_date,
            'site_delivery_date' => $orderFacture->delivery_date,
            'amount_ht' => $invHt,
            'amount_ttc' => $invTtc,
            'tva_rate' => $tva,
            'billing_address_id' => $addrBtBill->id,
            'delivery_address_id' => null,
            'pdf_template_id' => $pdfInvoice?->id,
            'status' => Invoice::STATUS_SENT,
            'meta' => ['seed' => true, 'note' => 'Facture démo — lien commande SEED-FACTURE-LIE'],
        ]);

        InvoiceLine::create([
            'invoice_id' => $invoice->id,
            'description' => 'Forfait campagne géotechnique Lot 3 (acompte 40 %)',
            'quantity' => 1,
            'unit_price' => $invHt,
            'tva_rate' => $tva,
            'discount_percent' => 0,
            'total' => $invHt,
            'order_item_id' => null,
        ]);

        $invoice->orders()->syncWithoutDetaching([$orderFacture->id]);

        if (LabCadrage::count() === 0) {
            LabCadrage::create([
                'types_essais_demarrage' => ['beton', 'sols', 'granulats'],
                'normes_referentiels' => ['NF', 'EN', 'methodes_internes'],
                'perimetre' => 'multi_sites',
                'tracabilite_iso17025' => [
                    'audit_trail' => true,
                    'signatures' => true,
                    'etalonnages' => true,
                ],
                'checklist_done' => [
                    'types' => true,
                    'normes' => true,
                    'perimetre' => false,
                    'tracabilite' => true,
                ],
                'updated_by' => $admin->id,
            ]);
        }
    }
}
