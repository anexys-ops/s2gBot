<?php

namespace Tests\Feature;

use App\Models\DocumentPdfTemplate;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DocumentPdfTemplateCrudTest extends TestCase
{
    use RefreshDatabase;

    public function test_lab_admin_can_delete_non_default_template(): void
    {
        $admin = User::factory()->create([
            'role' => User::ROLE_LAB_ADMIN,
            'client_id' => null,
            'site_id' => null,
        ]);

        $default = DocumentPdfTemplate::query()->create([
            'document_type' => 'quote',
            'slug' => 'devis-defaut-test',
            'name' => 'Devis défaut test',
            'blade_view' => 'pdf.quote',
            'is_default' => true,
            'is_active' => true,
            'layout_config' => [],
        ]);
        $extra = DocumentPdfTemplate::query()->create([
            'document_type' => 'quote',
            'slug' => 'devis-second-test',
            'name' => 'Devis second test',
            'blade_view' => 'pdf.quote',
            'is_default' => false,
            'is_active' => true,
            'layout_config' => [],
        ]);

        $this->actingAs($admin, 'sanctum')
            ->deleteJson("/api/document-pdf-templates/{$extra->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('document_pdf_templates', ['id' => $extra->id]);
        $this->assertDatabaseHas('document_pdf_templates', ['id' => $default->id]);
    }

    public function test_cannot_delete_default_template(): void
    {
        $admin = User::factory()->create([
            'role' => User::ROLE_LAB_ADMIN,
            'client_id' => null,
            'site_id' => null,
        ]);

        $default = DocumentPdfTemplate::query()->create([
            'document_type' => 'invoice',
            'slug' => 'facture-defaut-test',
            'name' => 'Facture défaut test',
            'blade_view' => 'pdf.invoice',
            'is_default' => true,
            'is_active' => true,
            'layout_config' => [],
        ]);
        DocumentPdfTemplate::query()->create([
            'document_type' => 'invoice',
            'slug' => 'facture-second-test',
            'name' => 'Facture second test',
            'blade_view' => 'pdf.invoice',
            'is_default' => false,
            'is_active' => true,
            'layout_config' => [],
        ]);

        $this->actingAs($admin, 'sanctum')
            ->deleteJson("/api/document-pdf-templates/{$default->id}")
            ->assertStatus(422)
            ->assertJsonPath('message', 'Impossible de supprimer le modèle par défaut. Choisissez d’abord un autre modèle par défaut.');
    }

    public function test_cannot_delete_last_template_for_type(): void
    {
        $admin = User::factory()->create([
            'role' => User::ROLE_LAB_ADMIN,
            'client_id' => null,
            'site_id' => null,
        ]);

        DocumentPdfTemplate::query()->where('document_type', 'expense_report')->delete();

        $only = DocumentPdfTemplate::query()->create([
            'document_type' => 'expense_report',
            'slug' => 'ndf-unique-test',
            'name' => 'NDF unique test',
            'blade_view' => 'pdf.expense_report',
            'is_default' => false,
            'is_active' => true,
            'layout_config' => [],
        ]);

        $this->actingAs($admin, 'sanctum')
            ->deleteJson("/api/document-pdf-templates/{$only->id}")
            ->assertStatus(422)
            ->assertJsonPath('message', 'Impossible de supprimer le dernier modèle pour ce type de document.');
    }

    public function test_lab_technician_cannot_delete_template(): void
    {
        $tech = User::factory()->create([
            'role' => User::ROLE_LAB_TECHNICIAN,
            'client_id' => null,
            'site_id' => null,
        ]);

        DocumentPdfTemplate::query()->create([
            'document_type' => 'quote',
            'slug' => 'devis-tech-test-a',
            'name' => 'Devis tech A',
            'blade_view' => 'pdf.quote',
            'is_default' => true,
            'is_active' => true,
            'layout_config' => [],
        ]);
        $extra = DocumentPdfTemplate::query()->create([
            'document_type' => 'quote',
            'slug' => 'devis-tech-test-b',
            'name' => 'Devis tech B',
            'blade_view' => 'pdf.quote',
            'is_default' => false,
            'is_active' => true,
            'layout_config' => [],
        ]);

        $this->actingAs($tech, 'sanctum')
            ->deleteJson("/api/document-pdf-templates/{$extra->id}")
            ->assertForbidden();
    }
}
