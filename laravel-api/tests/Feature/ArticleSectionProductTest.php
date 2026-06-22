<?php

namespace Tests\Feature;

use App\Models\ArticleSectionProduct;
use App\Models\Catalogue\Article;
use App\Models\User;
use Database\Seeders\S2gCatalogueSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ArticleSectionProductTest extends TestCase
{
    use RefreshDatabase;

    public function test_jalon_can_assign_products_per_section(): void
    {
        $this->seed(S2gCatalogueSeeder::class);

        $jalon = Article::query()
            ->where('kind', Article::KIND_JALON)
            ->get()
            ->first(fn (Article $j) => $j->jalonProductLinks()->pluck('product_article_id')->unique()->count() >= 2);

        $this->assertNotNull($jalon, 'Aucun jalon avec au moins 2 produits distincts dans le jeu S2G.');

        $products = $jalon->jalonProductLinks()
            ->pluck('product_article_id')
            ->unique()
            ->values()
            ->all();
        $this->assertGreaterThanOrEqual(2, count($products));

        $lab = User::factory()->create([
            'role' => User::ROLE_LAB_ADMIN,
            'client_id' => null,
            'site_id' => null,
        ]);

        $this->actingAs($lab, 'sanctum')->putJson("/api/articles/{$jalon->id}/section-products", [
            'section_type' => ArticleSectionProduct::SECTION_TECHNICIEN,
            'product_article_ids' => array_slice($products, 0, 2),
        ])->assertOk()
            ->assertJsonCount(2, 'technicien');

        $this->actingAs($lab, 'sanctum')->putJson("/api/articles/{$jalon->id}/section-products", [
            'section_type' => ArticleSectionProduct::SECTION_LABO,
            'product_article_ids' => [$products[0]],
        ])->assertOk()
            ->assertJsonCount(2, 'technicien')
            ->assertJsonCount(1, 'labo');

        $this->assertSame(3, ArticleSectionProduct::query()->where('ref_article_id', $jalon->id)->count());
    }

    public function test_product_can_be_assigned_to_single_section(): void
    {
        $this->seed(S2gCatalogueSeeder::class);

        $product = Article::query()->where('kind', Article::KIND_PRODUCT)->firstOrFail();
        $lab = User::factory()->create([
            'role' => User::ROLE_LAB_ADMIN,
            'client_id' => null,
            'site_id' => null,
        ]);

        $this->actingAs($lab, 'sanctum')->putJson("/api/articles/{$product->id}/section-products", [
            'section_type' => ArticleSectionProduct::SECTION_INGENIEUR,
            'product_article_ids' => [$product->id],
        ])->assertOk()
            ->assertJsonCount(1, 'ingenieur');

        $this->actingAs($lab, 'sanctum')->putJson("/api/articles/{$product->id}/section-products", [
            'section_type' => ArticleSectionProduct::SECTION_LABO,
            'product_article_ids' => [$product->id],
        ])->assertOk()
            ->assertJsonCount(0, 'ingenieur')
            ->assertJsonCount(1, 'labo');

        $this->assertSame(1, ArticleSectionProduct::query()->where('ref_article_id', $product->id)->count());
    }
}
