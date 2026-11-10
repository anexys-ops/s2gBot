<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Quote;
use App\Models\Site;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Tri et filtres communs des vues liste (App\Support\ListQuery). */
class ListQuerySortingTest extends TestCase
{
    use RefreshDatabase;

    public function test_quotes_default_to_latest_created_and_accept_common_sort_and_filters(): void
    {
        $lab = User::factory()->create(['role' => User::ROLE_LAB_ADMIN, 'client_id' => null, 'site_id' => null]);
        $zeta = Client::query()->create(['name' => 'Zeta BTP']);
        $alpha = Client::query()->create(['name' => 'Alpha Travaux']);
        $old = $this->quote($zeta, 'DEV-A', '2026-11-01', '2026-01-10 08:00:00');
        $new = $this->quote($alpha, 'DEV-B', '2026-01-01', '2026-03-10 08:00:00');

        $default = $this->actingAs($lab, 'sanctum')->getJson('/api/quotes')->assertOk()->json('data');
        $this->assertSame([$new->id, $old->id], array_column($default, 'id'));

        $byDate = $this->actingAs($lab, 'sanctum')->getJson('/api/quotes?sort=date&direction=desc')->json('data');
        $this->assertSame([$old->id, $new->id], array_column($byDate, 'id'));

        $byClient = $this->actingAs($lab, 'sanctum')->getJson('/api/quotes?sort=client&direction=asc')->json('data');
        $this->assertSame([$new->id, $old->id], array_column($byClient, 'id'));

        $filtered = $this->actingAs($lab, 'sanctum')
            ->getJson('/api/quotes?created_from=2026-02-01&created_to=2026-12-31')->json('data');
        $this->assertSame([$new->id], array_column($filtered, 'id'));

        $byClientFilter = $this->actingAs($lab, 'sanctum')->getJson("/api/quotes?client_id={$zeta->id}")->json('data');
        $this->assertSame([$old->id], array_column($byClientFilter, 'id'));

        // Clé inconnue : retombe sur le tri par défaut, sans erreur SQL.
        $this->actingAs($lab, 'sanctum')->getJson('/api/quotes?sort=drop_table&direction=sideways')->assertOk();
    }

    public function test_clients_dropdown_stays_alphabetical_without_sort_param(): void
    {
        $lab = User::factory()->create(['role' => User::ROLE_LAB_ADMIN, 'client_id' => null, 'site_id' => null]);
        Client::query()->create(['name' => 'Zeta BTP']);
        Client::query()->create(['name' => 'Alpha Travaux']);

        $names = array_column($this->actingAs($lab, 'sanctum')->getJson('/api/clients')->assertOk()->json(), 'name');
        $this->assertSame(['Alpha Travaux', 'Zeta BTP'], array_values(array_intersect($names, ['Alpha Travaux', 'Zeta BTP'])));

        $latest = $this->actingAs($lab, 'sanctum')->getJson('/api/clients?page=1&sort=created_at&direction=desc')->json('data');
        $this->assertSame('Alpha Travaux', $latest[0]['name']);
    }

    private function quote(Client $client, string $number, string $date, string $createdAt): Quote
    {
        $site = Site::query()->create(['client_id' => $client->id, 'name' => 'Site '.$number]);
        $quote = Quote::query()->create([
            'number' => $number, 'client_id' => $client->id, 'site_id' => $site->id,
            'quote_date' => $date, 'amount_ht' => 100, 'amount_ttc' => 120, 'tva_rate' => 20, 'status' => 'draft',
        ]);
        $quote->forceFill(['created_at' => $createdAt])->saveQuietly();

        return $quote;
    }
}
