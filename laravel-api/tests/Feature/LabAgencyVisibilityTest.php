<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Client;
use App\Models\User;
use App\Support\AgencyAccess;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LabAgencyVisibilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_internal_user_sees_only_clients_linked_to_their_lab_agency(): void
    {
        $labAgency = Agency::query()->create([
            'name' => 'Agence Test',
            'code' => 'TST',
            'active' => true,
        ]);
        $otherAgency = Agency::query()->create([
            'name' => 'Autre',
            'code' => 'OTH',
            'active' => true,
        ]);

        $visibleClient = Client::query()->create(['name' => 'Client visible']);
        $hiddenClient = Client::query()->create(['name' => 'Client caché']);
        $globalClient = Client::query()->create(['name' => 'Client global']);
        $visibleClient->visibleLabAgencies()->sync([$labAgency->id]);
        $hiddenClient->visibleLabAgencies()->sync([$otherAgency->id]);

        $user = User::factory()->create([
            'role' => User::ROLE_COMMERCIAL,
            'agency_id' => $labAgency->id,
        ]);

        $this->assertTrue(AgencyAccess::userMayAccessClient($user, $visibleClient));
        $this->assertFalse(AgencyAccess::userMayAccessClient($user, $hiddenClient));
        $this->assertTrue(AgencyAccess::userMayAccessClient($user, $globalClient));
    }

    public function test_siege_user_sees_all_clients(): void
    {
        $labAgency = Agency::query()->create(['name' => 'A1', 'code' => 'A1', 'active' => true]);
        $client = Client::query()->create(['name' => 'Restreint']);
        $client->visibleLabAgencies()->sync([$labAgency->id]);

        $siege = User::factory()->create([
            'role' => User::ROLE_LAB_ADMIN,
            'agency_id' => null,
        ]);

        $this->assertTrue(AgencyAccess::userMayAccessClient($siege, $client));
    }
}
