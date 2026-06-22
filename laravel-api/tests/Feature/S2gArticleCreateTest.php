<?php

namespace Tests\Feature;

use App\Models\Catalogue\Article;
use App\Models\JalonProduct;
use App\Models\QualificationTag;
use App\Models\User;
use Database\Seeders\S2gCatalogueSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class S2gArticleCreateTest extends TestCase
{
    use RefreshDatabase;

    public function test_lab_admin_can_create_product_visible_in_catalogue_listing(): void
    {
        $this->seed(S2gCatalogueSeeder::class);

        $template = Article::query()->where('kind', Article::KIND_PRODUCT)->firstOrFail();
        $jalon = Article::query()->where('kind', Article::KIND_JALON)->firstOrFail();

        $lab = User::factory()->create([
            'role' => User::ROLE_LAB_ADMIN,
            'client_id' => null,
            'site_id' => null,
        ]);

        $response = $this->actingAs($lab, 'sanctum')->postJson('/api/v1/catalogue/articles', [
            'ref_famille_article_id' => $template->ref_famille_article_id,
            'code' => 'TEST-PROD-CREATE',
            'libelle' => 'Produit créé en test',
            'kind' => Article::KIND_PRODUCT,
            'jalon_article_ids' => [$jalon->id],
            'actif' => true,
        ]);

        $response->assertCreated();
        $payload = $response->json('data') ?? $response->json();
        $this->assertSame('product', $payload['kind']);
        $this->assertSame('TEST-PROD-CREATE', $payload['code']);

        $createdId = (int) $payload['id'];
        $this->assertTrue(
            JalonProduct::query()
                ->where('product_article_id', $createdId)
                ->where('jalon_article_id', $jalon->id)
                ->exists()
        );

        $listing = $this->actingAs($lab, 'sanctum')
            ->getJson('/api/v1/catalogue/articles?q=TEST-PROD-CREATE')
            ->assertOk()
            ->json();

        $this->assertCount(1, $listing);
        $this->assertSame('product', $listing[0]['kind']);
    }

    public function test_lab_admin_can_create_jalon_with_tags_and_products(): void
    {
        $this->seed(S2gCatalogueSeeder::class);

        $template = Article::query()->where('kind', Article::KIND_JALON)->firstOrFail();
        $products = Article::query()->where('kind', Article::KIND_PRODUCT)->limit(2)->pluck('id')->all();
        $tags = QualificationTag::query()->limit(2)->pluck('id')->all();

        $lab = User::factory()->create([
            'role' => User::ROLE_LAB_ADMIN,
            'client_id' => null,
            'site_id' => null,
        ]);

        $response = $this->actingAs($lab, 'sanctum')->postJson('/api/v1/catalogue/articles', [
            'ref_famille_article_id' => $template->ref_famille_article_id,
            'code' => 'TEST-JALON-CREATE',
            'libelle' => 'Jalon créé en test',
            'kind' => Article::KIND_JALON,
            'famille_label' => 'Test famille',
            'qualification_tag_ids' => $tags,
            'product_article_ids' => $products,
            'actif' => true,
        ]);

        $response->assertCreated();
        $payload = $response->json('data') ?? $response->json();
        $this->assertSame('jalon', $payload['kind']);
        $this->assertSame('Test famille', $payload['famille_label']);

        $jalonId = (int) $payload['id'];
        $jalon = Article::query()->findOrFail($jalonId);

        $this->assertSame(count($tags), $jalon->qualificationTags()->count());
        $this->assertSame(count($products), $jalon->jalonProductLinks()->count());
        $this->assertSame(
            $products,
            $jalon->jalonProductLinks()->orderBy('ordre')->pluck('product_article_id')->all()
        );
    }

    public function test_create_without_kind_is_rejected_when_s2g_catalogue_exists(): void
    {
        $this->seed(S2gCatalogueSeeder::class);

        $template = Article::query()->where('kind', Article::KIND_PRODUCT)->firstOrFail();
        $lab = User::factory()->create([
            'role' => User::ROLE_LAB_ADMIN,
            'client_id' => null,
            'site_id' => null,
        ]);

        $this->actingAs($lab, 'sanctum')->postJson('/api/v1/catalogue/articles', [
            'ref_famille_article_id' => $template->ref_famille_article_id,
            'code' => 'TEST-LEGACY-MISSING-KIND',
            'libelle' => 'Sans kind',
            'actif' => true,
        ])->assertUnprocessable();
    }

    public function test_article_show_exposes_product_jalons_for_products(): void
    {
        $this->seed(S2gCatalogueSeeder::class);

        $product = Article::query()
            ->where('kind', Article::KIND_PRODUCT)
            ->whereHas('productJalonLinks')
            ->firstOrFail();

        $lab = User::factory()->create([
            'role' => User::ROLE_LAB_ADMIN,
            'client_id' => null,
            'site_id' => null,
        ]);

        $response = $this->actingAs($lab, 'sanctum')
            ->getJson('/api/v1/catalogue/articles/'.$product->id);

        $response->assertOk();
        $payload = $response->json('data') ?? $response->json();
        $this->assertSame('product', $payload['kind']);
        $this->assertIsArray($payload['product_jalons']);
        $this->assertGreaterThan(0, count($payload['product_jalons']));
    }

    public function test_lab_admin_can_update_product_jalon_links(): void
    {
        $this->seed(S2gCatalogueSeeder::class);

        $product = Article::query()->where('kind', Article::KIND_PRODUCT)->firstOrFail();
        $jalons = Article::query()->where('kind', Article::KIND_JALON)->limit(2)->pluck('id')->all();

        $lab = User::factory()->create([
            'role' => User::ROLE_LAB_ADMIN,
            'client_id' => null,
            'site_id' => null,
        ]);

        $response = $this->actingAs($lab, 'sanctum')->putJson('/api/v1/catalogue/articles/'.$product->id, [
            'libelle' => $product->libelle,
            'jalon_article_ids' => $jalons,
        ]);

        $response->assertOk();
        $payload = $response->json('data') ?? $response->json();
        $this->assertIsArray($payload['product_jalons']);
        $this->assertSame(
            $jalons,
            collect($payload['product_jalons'])->pluck('jalon.id')->filter()->values()->all()
        );
    }

    public function test_lab_admin_can_update_jalon_tags_and_products(): void
    {
        $this->seed(S2gCatalogueSeeder::class);

        $jalon = Article::query()->where('kind', Article::KIND_JALON)->firstOrFail();
        $products = Article::query()->where('kind', Article::KIND_PRODUCT)->limit(1)->pluck('id')->all();
        $tags = QualificationTag::query()->limit(1)->pluck('id')->all();

        $lab = User::factory()->create([
            'role' => User::ROLE_LAB_ADMIN,
            'client_id' => null,
            'site_id' => null,
        ]);

        $response = $this->actingAs($lab, 'sanctum')->putJson('/api/v1/catalogue/articles/'.$jalon->id, [
            'libelle' => 'Jalon modifié en test',
            'famille_label' => 'Famille modifiée',
            'qualification_tag_ids' => $tags,
            'product_article_ids' => $products,
        ]);

        $response->assertOk();
        $payload = $response->json('data') ?? $response->json();
        $this->assertSame('Jalon modifié en test', $payload['libelle']);
        $this->assertSame('Famille modifiée', $payload['famille_label']);
        $this->assertCount(1, $payload['qualification_tags']);
        $this->assertCount(1, $payload['jalon_products']);
    }
}
