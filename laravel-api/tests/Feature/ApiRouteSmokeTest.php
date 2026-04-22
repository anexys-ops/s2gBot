<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Fume le plus de routes GET en 200 (lab) pour le seuil de couverture (BDC-63 / DT-4),
 * sans valider le détail métier (déjà couvert par d’autres feature tests).
 */
class ApiRouteSmokeTest extends TestCase
{
    use RefreshDatabase;

    public function test_lab_admin_can_reach_core_listing_endpoints(): void
    {
        $admin = User::factory()->create([
            'role' => User::ROLE_LAB_ADMIN,
            'client_id' => null,
            'site_id' => null,
        ]);
        $this->actingAs($admin, 'sanctum');

        $paths = [
            '/api/user',
            '/api/orders?per_page=1',
            '/api/clients?per_page=1',
            '/api/sites?per_page=1',
            '/api/test-types?per_page=1',
            '/api/equipments?per_page=1',
            '/api/invoices?per_page=1',
            '/api/quotes?per_page=1',
            '/api/commercial-offerings?per_page=1',
            '/api/activity-logs?per_page=1',
            '/api/stats/essais',
            '/api/stats/dashboard',
            '/api/mail/templates',
            '/api/mail-templates',
            '/api/mail/logs',
            '/api/pdf/templates',
            '/api/branding',
            '/api/cadrage',
            '/api/btp-calculations/exemples',
            '/api/v1/dossiers?per_page=1',
            '/api/v1/catalogue/familles',
            '/api/v1/catalogue/arbre',
            '/api/v1/catalogue/articles?per_page=1',
            '/api/v1/catalogue/packages?per_page=1',
            '/api/v1/workflow-definitions',
            '/api/report-pdf-templates',
            '/api/report-form-definitions',
            '/api/document-pdf-templates',
            '/api/extrafield-definitions?per_page=1',
            '/api/admin/users?per_page=1',
            '/api/admin/access-groups?per_page=1',
        ];

        foreach ($paths as $path) {
            $this->getJson($path)->assertOk();
        }
    }

    public function test_public_version_and_openapi_respond(): void
    {
        $this->getJson('/api/version')
            ->assertOk()
            ->assertJsonStructure(['laravel', 'php', 'api', 'app_env']);

        $this->getJson('/api/openapi.json')
            ->assertOk()
            ->assertJsonStructure(['openapi', 'paths']);
    }
}
