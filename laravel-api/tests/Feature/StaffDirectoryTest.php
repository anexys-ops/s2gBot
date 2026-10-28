<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StaffDirectoryTest extends TestCase
{
    use RefreshDatabase;

    /** @return array<string, array{0: string}> */
    public static function internalRoles(): array
    {
        return [
            'technicien' => [User::ROLE_LAB_TECHNICIAN],
            'superviseur' => [User::ROLE_RESPONSABLE],
            'ingenieur' => [User::ROLE_INGENIEUR],
            'laborantin' => [User::ROLE_LABORANTIN],
            'receptionnaire' => [User::ROLE_RECEPTIONNAIRE],
            'commercial' => [User::ROLE_COMMERCIAL],
            'admin' => [User::ROLE_LAB_ADMIN],
        ];
    }

    /** @dataProvider internalRoles */
    public function test_staff_directory_is_not_paginated_and_open_to_internal_roles(string $role): void
    {
        // > 20 comptes : l'ancienne liste admin paginée masquait les derniers.
        foreach (range(1, 30) as $i) {
            User::factory()->create(['name' => sprintf('Zz Tech %02d', $i), 'role' => User::ROLE_LAB_TECHNICIAN, 'client_id' => null, 'site_id' => null]);
        }
        $viewer = User::factory()->create(['role' => $role, 'client_id' => null, 'site_id' => null]);

        $res = $this->actingAs($viewer, 'sanctum')->getJson('/api/staff-users')->assertOk();

        $names = collect($res->json())->pluck('name');
        $this->assertTrue($names->contains('Zz Tech 30'));
        $this->assertGreaterThanOrEqual(31, $names->count());
    }

    public function test_staff_directory_is_forbidden_to_portal_clients(): void
    {
        $client = User::factory()->create(['role' => User::ROLE_CLIENT]);

        $this->actingAs($client, 'sanctum')->getJson('/api/staff-users')->assertForbidden();
        $this->actingAs($client, 'sanctum')->getJson('/api/v1/planning-terrain/techniciens?context=labo')->assertForbidden();
    }

    /** @dataProvider internalRoles */
    public function test_assignable_list_includes_supervisors_and_engineers_in_every_context(string $role): void
    {
        $viewer = User::factory()->create(['role' => $role, 'client_id' => null, 'site_id' => null]);
        $resp = User::factory()->create(['role' => User::ROLE_RESPONSABLE, 'client_id' => null, 'site_id' => null]);
        $ing = User::factory()->create(['role' => User::ROLE_INGENIEUR, 'client_id' => null, 'site_id' => null]);
        $tech = User::factory()->create(['role' => User::ROLE_LAB_TECHNICIAN, 'client_id' => null, 'site_id' => null]);
        $commercial = User::factory()->create(['role' => User::ROLE_COMMERCIAL, 'client_id' => null, 'site_id' => null]);

        foreach (['terrain', 'labo', 'ingenieur'] as $context) {
            $ids = collect($this->actingAs($viewer, 'sanctum')->getJson("/api/v1/planning-terrain/techniciens?context={$context}")->assertOk()->json())->pluck('id');
            foreach ([$resp, $ing, $tech] as $u) {
                $this->assertTrue($ids->contains($u->id), "{$context}: {$u->role} manquant pour {$role}");
            }
            $this->assertFalse($ids->contains($commercial->id));
        }
    }
}
