<?php

namespace Tests\Unit;

use App\Models\BonCommande;
use App\Models\BonCommandeLigne;
use App\Models\Catalogue\Article;
use App\Models\Catalogue\FamilleArticle;
use App\Models\Client;
use App\Models\ClientContact;
use App\Models\Dossier;
use App\Models\DossierContact;
use App\Models\Site;
use App\Models\Quote;
use App\Models\User;
use App\Services\BonCommandePdfPresentationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BonCommandePdfPresentationTest extends TestCase
{
    use RefreshDatabase;

    public function test_build_context_includes_client_dossier_and_site_details(): void
    {
        $user = User::factory()->create(['role' => User::ROLE_LAB_ADMIN, 'client_id' => null, 'site_id' => null]);
        $client = Client::query()->create([
            'name' => 'JET-CONTRACTORS',
            'address' => '12 rue Atlas',
            'city' => 'Casablanca',
            'ice' => '001234567890123',
            'email' => 'contact@jet.ma',
            'phone' => '0522000000',
        ]);
        $site = Site::query()->create([
            'client_id' => $client->id,
            'name' => 'Tour Marina',
            'address' => 'Boulevard de la Corniche',
            'reference' => 'CH-001',
        ]);
        $dossier = Dossier::query()->create([
            'reference' => 'DOS-2026-001',
            'titre' => 'Contrôle béton',
            'client_id' => $client->id,
            'site_id' => $site->id,
            'statut' => Dossier::STATUT_EN_COURS,
            'date_debut' => '2026-03-01',
            'date_fin_prevue' => '2026-06-30',
            'maitre_ouvrage' => 'Promoteur ABC',
            'entreprise_chantier' => 'Entreprise XYZ',
            'notes' => 'Accès chantier côté nord.',
            'created_by' => $user->id,
        ]);
        DossierContact::query()->create([
            'dossier_id' => $dossier->id,
            'nom' => 'Benali',
            'prenom' => 'Karim',
            'role' => 'Conducteur de travaux',
            'email' => 'k.benali@xyz.ma',
            'telephone' => '0661000000',
        ]);
        $contact = ClientContact::query()->create([
            'client_id' => $client->id,
            'nom' => 'Alaoui',
            'prenom' => 'Sara',
            'poste' => 'Acheteuse',
            'email' => 's.alaoui@jet.ma',
            'telephone_mobile' => '0662000000',
        ]);
        $bc = BonCommande::query()->create([
            'numero' => 'BC-2026-001',
            'dossier_id' => $dossier->id,
            'client_id' => $client->id,
            'contact_id' => $contact->id,
            'statut' => BonCommande::STATUT_CONFIRME,
            'date_commande' => '2026-03-15',
            'montant_ht' => 1000,
            'montant_ttc' => 1200,
            'created_by' => $user->id,
        ]);

        $bc->load(['client', 'clientContact', 'createur', 'dossier.site', 'dossier.contacts']);

        $ctx = app(BonCommandePdfPresentationService::class)->buildContext($bc);

        $this->assertSame('Tour Marina — Contrôle béton', $ctx['affaire']);
        $this->assertSame('JET-CONTRACTORS', $ctx['client']['name']);
        $this->assertSame('001234567890123', $ctx['client']['ice']);
        $this->assertSame('Sara Alaoui', $ctx['client']['contact_name']);
        $this->assertSame('Sara Alaoui', $ctx['contact']['name']);
        $this->assertSame('DOS-2026-001', $ctx['dossier']['reference']);
        $this->assertSame('En cours', $ctx['dossier']['statut_label']);
        $this->assertSame('Promoteur ABC', $ctx['projet']['entreprise_mo']);
        $this->assertSame('Tour Marina', $ctx['site']['name']);
        $this->assertCount(1, $ctx['dossier_contacts']);
        $this->assertSame('Karim Benali', $ctx['dossier_contacts'][0]['name']);
        $this->assertSame('Confirmé', $ctx['bc_statut_label']);
        $this->assertSame('En-M-05-12', $ctx['form']['reference']);
        $this->assertCount(8, $ctx['prestation_types']);
    }

    public function test_build_context_reads_bc_recap_meta_overrides(): void
    {
        $user = User::factory()->create([
            'role' => User::ROLE_LAB_ADMIN,
            'client_id' => null,
            'site_id' => null,
            'email' => 'kh.mourid@s2g.ma',
        ]);
        $client = Client::query()->create(['name' => 'MR ALI LEHLOU', 'prolab_code' => 'TI4361']);
        $site = Site::query()->create(['client_id' => $client->id, 'name' => 'Maarif', 'reference' => 'AF6260']);
        $dossier = Dossier::query()->create([
            'reference' => 'DS0953/MO-26',
            'titre' => 'Construction immeuble',
            'client_id' => $client->id,
            'site_id' => $site->id,
            'statut' => Dossier::STATUT_EN_COURS,
            'date_debut' => '2026-09-01',
            'created_by' => $user->id,
        ]);
        $quote = \App\Models\Quote::query()->create([
            'number' => 'DV1409/MO-26',
            'client_id' => $client->id,
            'dossier_id' => $dossier->id,
            'quote_date' => '2026-09-09',
            'amount_ht' => 100,
            'amount_ttc' => 120,
            'status' => \App\Models\Quote::STATUS_ACCEPTED,
            'meta' => [
                'bc_recap' => [
                    'priorite' => 'prioritaire',
                    'prestation_types' => ['etude_geotechniques', 'essai_laboratoire'],
                    'documents' => [
                        'plans' => true,
                        'cahier_charges' => true,
                        'autres' => 'Plans architecte',
                    ],
                    'instructions' => 'Traitement prioritaire.',
                ],
            ],
        ]);
        $bc = BonCommande::query()->create([
            'numero' => 'BCC-2026-0099',
            'quote_id' => $quote->id,
            'dossier_id' => $dossier->id,
            'client_id' => $client->id,
            'statut' => BonCommande::STATUT_BROUILLON,
            'date_commande' => '2026-09-10',
            'montant_ht' => 100,
            'montant_ttc' => 120,
            'created_by' => $user->id,
        ]);

        $bc->load(['client', 'clientContact', 'createur', 'dossier.site', 'quote', 'lignes.article']);

        $ctx = app(BonCommandePdfPresentationService::class)->buildContext($bc);

        $this->assertSame('DV1409/MO-26', $ctx['devis']['number']);
        $this->assertSame('kh.mourid', $ctx['etabli_par']);
        $this->assertSame('prioritaire', $ctx['priorite']);
        $this->assertSame('Traitement prioritaire.', $ctx['instructions']);
        $this->assertTrue(collect($ctx['prestation_types'])->firstWhere('key', 'etude_geotechniques')['checked']);
        $this->assertTrue($ctx['documents']['plans']);
        $this->assertSame('Plans architecte', $ctx['documents']['autres']);
    }

    public function test_build_item_rows_groups_bc_lines_by_quote_jalon_and_uses_bc_quantities(): void
    {
        $client = Client::query()->create(['name' => 'Client PDF jalons']);
        $user = User::factory()->create(['role' => User::ROLE_LAB_ADMIN]);
        $site = Site::query()->create(['client_id' => $client->id, 'name' => 'Chantier PDF BC']);
        $dossier = Dossier::query()->create([
            'reference' => 'DOS-BC-PDF',
            'titre' => 'Dossier PDF BC',
            'client_id' => $client->id,
            'site_id' => $site->id,
            'statut' => Dossier::STATUT_EN_COURS,
            'date_debut' => '2026-09-01',
            'created_by' => $user->id,
        ]);
        $famille = FamilleArticle::query()->create([
            'code' => 'FAM-BC-PDF',
            'libelle' => 'Famille PDF BC',
            'actif' => true,
        ]);
        $article = Article::query()->create([
            'ref_famille_article_id' => $famille->id,
            'code' => 'BET-01',
            'libelle' => 'Essai béton',
            'description_commerciale' => "Essai béton\nPrélèvement sur chantier\nRapport détaillé",
            'unite' => 'U',
            'kind' => Article::KIND_PRODUCT,
            'actif' => true,
        ]);
        $quote = Quote::query()->create([
            'number' => 'DEV-BC-PDF',
            'client_id' => $client->id,
            'dossier_id' => $dossier->id,
            'quote_date' => '2026-09-01',
            'amount_ht' => 750,
            'amount_ttc' => 900,
            'status' => Quote::STATUS_SIGNED,
            'meta' => [
                'devis_jalons' => [[
                    'id' => 'j-beton',
                    'libelle' => 'Contrôle de béton',
                    's2g_code' => 'CB',
                    'mode' => 'forfait',
                    'product_ref_article_ids' => [$article->id],
                ]],
                'devis_parcours' => [['kind' => 'jalon', 'id' => 'j-beton']],
            ],
        ]);
        $bc = BonCommande::query()->create([
            'numero' => 'BCC-PDF-001',
            'quote_id' => $quote->id,
            'dossier_id' => $dossier->id,
            'client_id' => $client->id,
            'statut' => BonCommande::STATUT_CONFIRME,
            'date_commande' => '2026-09-02',
            'montant_ht' => 750,
            'montant_ttc' => 900,
            'created_by' => $user->id,
        ]);
        BonCommandeLigne::query()->create([
            'bon_commande_id' => $bc->id,
            'libelle' => 'Prestation forfaitaire — Contrôle de béton',
            'ordre' => 0,
            'quantite' => 3,
            'prix_unitaire_ht' => 250,
            'tva_rate' => 20,
            'montant_ht' => 750,
        ]);
        BonCommandeLigne::query()->create([
            'bon_commande_id' => $bc->id,
            'ref_article_id' => $article->id,
            'libelle' => 'Essai béton',
            'ordre' => 1,
            'quantite' => 3,
            'prix_unitaire_ht' => 0,
            'tva_rate' => 20,
            'montant_ht' => 0,
        ]);

        $rows = app(BonCommandePdfPresentationService::class)->buildItemRows($bc->fresh());

        $this->assertSame(['jalon_header', 'forfait_total', 'product'], array_column($rows, 'type'));
        $this->assertSame('Contrôle de béton', $rows[0]['label']);
        $this->assertSame(3, $rows[1]['qte']);
        $this->assertSame(250.0, $rows[1]['pu']);
        $this->assertSame(750.0, $rows[1]['pt']);
        $this->assertTrue($rows[2]['nested']);
        $this->assertNull($rows[2]['qte']);
        $this->assertNull($rows[2]['pu']);
        $this->assertSame(['Prélèvement sur chantier', 'Rapport détaillé'], $rows[2]['details']);
    }
}
