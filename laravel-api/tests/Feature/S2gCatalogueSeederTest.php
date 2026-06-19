<?php

namespace Tests\Feature;

use App\Models\Catalogue\Article;
use App\Models\JalonProduct;
use App\Models\QualificationTag;
use App\Models\User;
use Database\Seeders\CatalogueProLabSeeder;
use Database\Seeders\S2gCatalogueSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class S2gCatalogueSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_s2g_catalogue_seeder_imports_tags_jalons_products_and_pivots(): void
    {
        $this->seed(CatalogueProLabSeeder::class);
        $legacyCount = Article::query()->count();
        $this->assertGreaterThan(0, $legacyCount);

        $legacy = Article::query()->first();
        $legacy?->update(['tags' => ['béton', 'essai', 'catalogue']]);

        $this->seed(S2gCatalogueSeeder::class);

        $this->assertSame(17, QualificationTag::query()->count());
        $this->assertSame(233, Article::query()->where('kind', Article::KIND_JALON)->count());
        $this->assertSame(841, Article::query()->where('kind', Article::KIND_PRODUCT)->count());
        $this->assertSame(1074, Article::query()->count());
        $this->assertSame(231, DB::table('qualification_tag_jalon')->count());
        $this->assertSame(1323, JalonProduct::query()->count());

        $jalon = Article::query()->where('code', 'Carr.UPEC')->first();
        $this->assertNotNull($jalon);
        $this->assertTrue($jalon->actif);
        $this->assertSame(Article::KIND_JALON, $jalon->kind);
        $this->assertGreaterThan(0, $jalon->jalonProductLinks()->count());

        $this->assertSame(0, Article::onlyTrashed()->count());
        $this->assertSame(0, Article::query()->where('code', 'BETON-FC28')->count());
        $this->assertTrue(
            Article::query()->whereIn('kind', [Article::KIND_JALON, Article::KIND_PRODUCT])->whereNotNull('tags')->count() === 0
        );
    }

    public function test_article_show_exposes_jalon_products_and_qualification_tags(): void
    {
        $this->seed(S2gCatalogueSeeder::class);

        $jalon = Article::query()->where('kind', Article::KIND_JALON)->firstOrFail();
        $lab = User::factory()->create([
            'role' => User::ROLE_LAB_ADMIN,
            'client_id' => null,
            'site_id' => null,
        ]);

        $response = $this->actingAs($lab, 'sanctum')
            ->getJson('/api/v1/catalogue/articles/'.$jalon->id);

        $response->assertOk();
        $payload = $response->json('data') ?? $response->json();
        $this->assertSame('jalon', $payload['kind']);
        $this->assertIsArray($payload['jalon_products']);
        $this->assertIsArray($payload['qualification_tags']);
    }

    public function test_articles_index_shows_legacy_until_s2g_imported(): void
    {
        $this->seed(CatalogueProLabSeeder::class);

        $lab = User::factory()->create([
            'role' => User::ROLE_LAB_ADMIN,
            'client_id' => null,
            'site_id' => null,
        ]);

        $before = $this->actingAs($lab, 'sanctum')
            ->getJson('/api/v1/catalogue/articles')
            ->assertOk()
            ->json();

        $this->assertGreaterThan(0, count($before));

        $this->seed(S2gCatalogueSeeder::class);

        $after = $this->actingAs($lab, 'sanctum')
            ->getJson('/api/v1/catalogue/articles')
            ->assertOk()
            ->json();

        $this->assertCount(1074, $after);
        foreach ($after as $row) {
            $this->assertContains($row['kind'], ['jalon', 'product']);
        }
    }

    public function test_articles_index_filters_by_kind(): void
    {
        $this->seed(S2gCatalogueSeeder::class);

        $lab = User::factory()->create([
            'role' => User::ROLE_LAB_ADMIN,
            'client_id' => null,
            'site_id' => null,
        ]);

        $products = $this->actingAs($lab, 'sanctum')
            ->getJson('/api/v1/catalogue/articles?kind=product')
            ->assertOk()
            ->json();

        $this->assertCount(841, $products);
        foreach ($products as $row) {
            $this->assertSame('product', $row['kind']);
        }
    }
}
