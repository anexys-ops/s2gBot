<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Catalogue\Article;
use App\Models\Catalogue\Tache;
use App\Models\Client;
use App\Models\DevisTache;
use App\Models\Site;
use App\Models\User;
use Database\Seeders\CatalogueProLabSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProlabDossierAndDevisApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_lab_creates_dossier_and_lists_it(): void
    {
        $client = Client::query()->create(['name' => 'Dossier API Co']);
        $site = Site::query()->create(['client_id' => $client->id, 'name' => 'Chantier 1']);
        $lab = User::factory()->create([
            'role' => User::ROLE_LAB_TECHNICIAN,
            'client_id' => null,
            'site_id' => null,
        ]);

        $res = $this->actingAs($lab, 'sanctum')->postJson('/api/v1/dossiers', [
            'titre' => 'Dossier test P2',
            'client_id' => $client->id,
            'site_id' => $site->id,
            'statut' => 'brouillon',
            'date_debut' => '2026-01-10',
        ]);

        $res->assertCreated();
        $id = (int) $res->json('id');
        $this->assertNotSame(0, $id);

        $list = $this->actingAs($lab, 'sanctum')->getJson('/api/v1/dossiers?client_id='.$client->id);
        $list->assertOk();
        $this->assertGreaterThanOrEqual(1, count($list->json()));
    }

    public function test_catalogue_taches_list_requires_auth(): void
    {
        $this->getJson('/api/v1/catalogue/taches')->assertUnauthorized();
    }

    public function test_catalogue_taches_list_returns_taches_for_lab(): void
    {
        Tache::query()->create([
            'code' => 'T-PT-1',
            'libelle' => 'Prélèvement',
        ]);

        $lab = User::factory()->create([
            'role' => User::ROLE_LAB_ADMIN,
            'client_id' => null,
            'site_id' => null,
        ]);

        $r = $this->actingAs($lab, 'sanctum')->getJson('/api/v1/catalogue/taches');
        $r->assertOk();
        $this->assertNotEmpty($r->json());
    }

    public function test_quote_stores_prolab_line_and_devis_taches(): void
    {
        $this->seed(CatalogueProLabSeeder::class);

        $client = Client::query()->create(['name' => 'Devis Prolab Co']);
        Agency::query()->create([
            'client_id' => $client->id,
            'name' => 'Siège',
            'is_headquarters' => true,
        ]);

        $tache = Tache::query()->create([
            'code' => 'T-DEV-1',
            'libelle' => 'Tâche devis',
        ]);

        $article = Article::query()->actif()->firstOrFail();
        $lab = User::factory()->create([
            'role' => User::ROLE_LAB_TECHNICIAN,
            'client_id' => null,
            'site_id' => null,
        ]);

        $payload = [
            'client_id' => $client->id,
            'quote_date' => '2026-04-20',
            'tva_rate' => 20,
            'lines' => [
                [
                    'description' => 'Ligne liée article catalogue',
                    'quantity' => 1,
                    'unit_price' => 100,
                    'ref_article_id' => $article->id,
                ],
            ],
            'taches' => [
                [
                    'ref_tache_id' => $tache->id,
                    'quantite' => 2,
                    'prix_unitaire_ht' => 40,
                    'statut' => DevisTache::STATUT_A_FAIRE,
                    'ordre' => 0,
                ],
            ],
        ];

        $q = $this->actingAs($lab, 'sanctum')->postJson('/api/quotes', $payload);
        $q->assertCreated();
        $q->assertJsonPath('quote_lines.0.ref_article_id', $article->id);
        $q->assertJsonPath('devis_taches.0.ref_tache_id', $tache->id);
        $q->assertJsonPath('devis_taches.0.quantite', 2);
    }

    public function test_dossier_bons_index_returns_bcc_bl_arrays(): void
    {
        $client = Client::query()->create(['name' => 'BC/BL Dossier Co']);
        $site = Site::query()->create(['client_id' => $client->id, 'name' => 'Chantier B']);
        $lab = User::factory()->create([
            'role' => User::ROLE_LAB_ADMIN,
            'client_id' => null,
            'site_id' => null,
        ]);

        $d = $this->actingAs($lab, 'sanctum')->postJson('/api/v1/dossiers', [
            'titre' => 'Dossier bons',
            'client_id' => $client->id,
            'site_id' => $site->id,
            'statut' => 'brouillon',
            'date_debut' => '2026-02-01',
        ]);
        $d->assertCreated();
        $dossierId = (int) $d->json('id');

        $r = $this->actingAs($lab, 'sanctum')->getJson("/api/v1/dossiers/{$dossierId}/bons");
        $r->assertOk();
        $r->assertJsonStructure(['bons_commande', 'bons_livraison']);
        $this->assertSame([], $r->json('bons_commande'));
        $this->assertSame([], $r->json('bons_livraison'));
    }
}
