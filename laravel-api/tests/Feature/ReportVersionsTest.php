<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Client;
use App\Models\Order;
use App\Models\Report;
use App\Models\ReportVersion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class ReportVersionsTest extends TestCase
{
    use RefreshDatabase;

    private function makeReport(): Report
    {
        $client = Client::create(['name' => 'RepCo']);
        $agencyId = Agency::query()->where('client_id', $client->id)->where('is_headquarters', true)->value('id');
        $tplId = (int) DB::table('report_pdf_templates')->value('id');

        $order = Order::create([
            'reference' => 'ORD-RV-'.uniqid(),
            'client_id' => $client->id,
            'agency_id' => $agencyId,
            'status' => Order::STATUS_COMPLETED,
            'order_date' => now()->toDateString(),
        ]);

        return Report::create([
            'order_id' => $order->id,
            'pdf_template_id' => $tplId,
            'file_path' => 'reports/test-rv.pdf',
            'filename' => 'test-rv.pdf',
            'form_data' => ['section' => 'A'],
            'generated_at' => now(),
            'review_status' => Report::REVIEW_DRAFT,
        ]);
    }

    public function test_submit_review_creates_version_row(): void
    {
        $report = $this->makeReport();
        $lab = User::factory()->labAdmin()->create();

        $this->actingAs($lab, 'sanctum')
            ->postJson("/api/reports/{$report->id}/submit-review")
            ->assertOk();

        $this->assertSame(1, ReportVersion::query()->where('report_id', $report->id)->count());
    }

    public function test_versions_endpoint_lab_only(): void
    {
        $report = $this->makeReport();
        $lab = User::factory()->labAdmin()->create();
        $clientUser = User::factory()->forClient(Client::find($report->order->client_id))->create([
            'role' => User::ROLE_CLIENT,
        ]);

        $this->actingAs($clientUser, 'sanctum')
            ->getJson("/api/reports/{$report->id}/versions")
            ->assertForbidden();

        $this->actingAs($lab, 'sanctum')
            ->getJson("/api/reports/{$report->id}/versions")
            ->assertOk()
            ->assertJsonStructure(['data']);
    }

    public function test_signed_report_cannot_change_form_data(): void
    {
        $report = $this->makeReport();
        $lab = User::factory()->labAdmin()->create();

        $report->update([
            'signed_at' => now(),
            'signed_by_user_id' => $lab->id,
            'signer_name' => 'Signataire',
        ]);

        $this->expectException(ValidationException::class);
        $report->update(['form_data' => ['changed' => true]]);
    }
}
