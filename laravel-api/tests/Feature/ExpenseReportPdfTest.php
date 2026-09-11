<?php

namespace Tests\Feature;

use App\Models\BonCommande;
use App\Models\Client;
use App\Models\Dossier;
use App\Models\ExpenseLine;
use App\Models\ExpenseReport;
use App\Models\OrdreMission;
use App\Models\Quote;
use App\Models\Site;
use App\Models\User;
use App\Services\ExpenseReportPdfGenerator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ExpenseReportPdfTest extends TestCase
{
    use RefreshDatabase;

    public function test_pdf_generator_includes_all_lines(): void
    {
        $user = User::factory()->create([
            'role'      => User::ROLE_LAB_ADMIN,
            'client_id' => null,
            'site_id'   => null,
        ]);
        Sanctum::actingAs($user);

        $client = Client::query()->create(['name' => 'Client PDF']);
        $site = Site::query()->create(['client_id' => $client->id, 'name' => 'Chantier PDF']);
        $dossier = Dossier::query()->create([
            'reference'  => 'DOS-PDF-001',
            'titre'      => 'Dossier PDF',
            'client_id'  => $client->id,
            'site_id'    => $site->id,
            'statut'     => Dossier::STATUT_BROUILLON,
            'date_debut' => '2026-09-01',
            'created_by' => $user->id,
        ]);
        $quote = Quote::query()->create([
            'number'     => 'DEV-PDF-001',
            'client_id'  => $client->id,
            'quote_date' => '2026-09-01',
            'amount_ht'  => 100,
            'amount_ttc' => 120,
            'status'     => Quote::STATUS_DRAFT,
        ]);
        $bc = BonCommande::query()->create([
            'numero'        => 'BC-PDF-001',
            'quote_id'      => $quote->id,
            'dossier_id'    => $dossier->id,
            'client_id'     => $client->id,
            'statut'        => BonCommande::STATUT_BROUILLON,
            'date_commande' => '2026-09-02',
            'montant_ht'    => 100,
            'montant_ttc'   => 120,
            'created_by'    => $user->id,
        ]);
        $om = OrdreMission::query()->create([
            'numero'          => 'OM-T-2026-PDF',
            'bon_commande_id' => $bc->id,
            'client_id'       => $client->id,
            'dossier_id'      => $dossier->id,
            'type'            => OrdreMission::TYPE_TECHNICIEN,
            'statut'          => OrdreMission::STATUT_PLANIFIE,
            'date_prevue'     => '2026-09-09',
            'responsable_id'  => $user->id,
        ]);

        $report = ExpenseReport::query()->create([
            'unique_number'    => 'NDF-PDF-001',
            'ordre_mission_id' => $om->id,
            'statut'           => ExpenseReport::STATUT_BROUILLON,
            'created_by'       => $user->id,
            'advance_amount'   => 10,
        ]);

        ExpenseLine::query()->create([
            'expense_report_id' => $report->id,
            'user_id'           => $user->id,
            'category'          => 'Repas',
            'amount'            => 45.5,
            'payment_method'    => 'cb',
            'date'              => '2026-09-09',
            'description'       => 'Déjeuner',
            'is_validated'      => true,
        ]);

        [$bytes, $filename] = app(ExpenseReportPdfGenerator::class)->generate($report->fresh());

        $this->assertNotEmpty($bytes);
        $this->assertStringStartsWith('%PDF', $bytes);
        $this->assertSame('ndf-NDF-PDF-001.pdf', $filename);

        $this->postJson('/api/pdf/generate', [
            'type' => 'expense_report',
            'id'   => $report->id,
        ])->assertOk();
    }
}
