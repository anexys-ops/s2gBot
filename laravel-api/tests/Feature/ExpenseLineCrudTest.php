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
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ExpenseLineCrudTest extends TestCase
{
    use RefreshDatabase;

    private function makeReport(User $user): ExpenseReport
    {
        $client = Client::query()->create(['name' => 'Client CRUD']);
        $site = Site::query()->create(['client_id' => $client->id, 'name' => 'Site CRUD']);
        $dossier = Dossier::query()->create([
            'reference'  => 'DOS-CRUD-001',
            'titre'      => 'Dossier CRUD',
            'client_id'  => $client->id,
            'site_id'    => $site->id,
            'statut'     => Dossier::STATUT_BROUILLON,
            'date_debut' => '2026-09-01',
            'created_by' => $user->id,
        ]);
        $quote = Quote::query()->create([
            'number'     => 'DEV-CRUD-001',
            'client_id'  => $client->id,
            'quote_date' => '2026-09-01',
            'amount_ht'  => 100,
            'amount_ttc' => 120,
            'status'     => Quote::STATUS_DRAFT,
        ]);
        $bc = BonCommande::query()->create([
            'numero'        => 'BC-CRUD-001',
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
            'numero'          => 'OM-T-2026-CRUD',
            'bon_commande_id' => $bc->id,
            'client_id'       => $client->id,
            'dossier_id'      => $dossier->id,
            'type'            => OrdreMission::TYPE_TECHNICIEN,
            'statut'          => OrdreMission::STATUT_PLANIFIE,
            'date_prevue'     => '2026-09-09',
            'responsable_id'  => $user->id,
        ]);

        return ExpenseReport::query()->create([
            'unique_number'    => 'NDF-CRUD-001',
            'ordre_mission_id' => $om->id,
            'statut'           => ExpenseReport::STATUT_BROUILLON,
            'created_by'       => $user->id,
        ]);
    }

    public function test_line_crud_with_payment_method_and_receipt(): void
    {
        Storage::fake('local');
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $report = $this->makeReport($user);

        $create = $this->postJson("/api/expense-reports/{$report->id}/lines", [
            'user_id'        => $user->id,
            'category'       => 'Repas',
            'amount'         => 45.50,
            'payment_method' => 'cb',
            'date'           => '2026-09-09',
            'description'    => 'Déjeuner chantier',
        ]);
        $create->assertCreated();
        $lineId = $create->json('id');

        $this->postJson("/api/expense-reports/{$report->id}/lines/{$lineId}/receipt", [
            'file' => UploadedFile::fake()->create('ticket.pdf', 100, 'application/pdf'),
        ])->assertOk()
            ->assertJsonPath('receipt_filename', 'ticket.pdf');

        $this->putJson("/api/expense-reports/{$report->id}/lines/{$lineId}", [
            'payment_method' => 'especes',
            'amount'         => 50,
        ])->assertOk()
            ->assertJsonPath('payment_method', 'especes')
            ->assertJsonPath('amount', 50);

        $line = ExpenseLine::query()->findOrFail($lineId);
        $this->assertNotNull($line->receipt_path);
        Storage::disk('local')->assertExists($line->receipt_path);

        $this->get("/api/expense-reports/{$report->id}/lines/{$lineId}/receipt")
            ->assertOk();

        $this->deleteJson("/api/expense-reports/{$report->id}/lines/{$lineId}")
            ->assertOk();

        $this->assertDatabaseMissing('expense_lines', ['id' => $lineId]);
    }

    public function test_create_expense_report_without_ordre_mission(): void
    {
        $user = User::factory()->create([
            'expense_taux_km'       => 0.55,
            'expense_forfait_repas' => 120,
        ]);
        Sanctum::actingAs($user);

        $create = $this->postJson('/api/expense-reports', [
            'notes' => 'NDF autonome',
        ]);

        $create->assertCreated();
        $create->assertJsonPath('ordre_mission_id', null);
        $create->assertJsonPath('user_id', $user->id);
        $create->assertJsonPath('statut', ExpenseReport::STATUT_BROUILLON);

        $reportId = $create->json('id');

        $this->postJson("/api/expense-reports/{$reportId}/lines", [
            'user_id'  => $user->id,
            'category' => 'Repas',
            'amount'   => 120,
            'date'     => '2026-09-10',
        ])->assertCreated()
            ->assertJsonPath('amount', 120);
    }

    public function test_line_mutations_blocked_when_not_brouillon(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);
        $report = $this->makeReport($user);
        $report->update(['statut' => ExpenseReport::STATUT_SOUMIS]);

        $this->postJson("/api/expense-reports/{$report->id}/lines", [
            'user_id'  => $user->id,
            'category' => 'Repas',
            'amount'   => 10,
            'date'     => '2026-09-09',
        ])->assertStatus(422);
    }
}
