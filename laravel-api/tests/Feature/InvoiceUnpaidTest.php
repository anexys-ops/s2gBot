<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

class InvoiceUnpaidTest extends TestCase
{
    use RefreshDatabase;

    private function createInvoice(Client $client, string $number, string $status, string $amountTtc): Invoice
    {
        $agencyId = Agency::query()
            ->where('client_id', $client->id)
            ->where('is_headquarters', true)
            ->value('id');

        return Invoice::create([
            'number' => $number,
            'client_id' => $client->id,
            'agency_id' => $agencyId,
            'invoice_date' => now()->toDateString(),
            'due_date' => now()->subDay()->toDateString(),
            'amount_ht' => '100.00',
            'amount_ttc' => $amountTtc,
            'tva_rate' => '20.00',
            'status' => $status,
        ]);
    }

    public function test_guest_cannot_list_unpaid_invoices(): void
    {
        $this->getJson('/api/invoices/unpaid')->assertUnauthorized();
    }

    public function test_lab_admin_sees_all_unpaid_and_total_matches_sum(): void
    {
        $c1 = Client::create(['name' => 'Alpha']);
        $c2 = Client::create(['name' => 'Beta']);

        $this->createInvoice($c1, 'FAC-A-1', Invoice::STATUS_SENT, '120.50');
        $this->createInvoice($c1, 'FAC-A-2', Invoice::STATUS_PAID, '999.00');
        $this->createInvoice($c2, 'FAC-B-1', Invoice::STATUS_VALIDATED, '200.00');

        $admin = User::factory()->labAdmin()->create();

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/invoices/unpaid');

        $response->assertOk();
        $response->assertJsonPath('total_amount_due_ttc', '320.50');
        $response->assertJsonCount(2, 'data');
    }

    public function test_client_sees_only_own_unpaid_invoices(): void
    {
        $mine = Client::create(['name' => 'Mine']);
        $other = Client::create(['name' => 'Other']);

        $this->createInvoice($mine, 'FAC-M-1', Invoice::STATUS_SENT, '50.00');
        $this->createInvoice($other, 'FAC-O-1', Invoice::STATUS_SENT, '70.00');

        $user = User::factory()->forClient($mine)->create([
            'role' => User::ROLE_CLIENT,
        ]);

        $response = $this->actingAs($user, 'sanctum')->getJson('/api/invoices/unpaid');

        $response->assertOk();
        $response->assertJsonPath('total_amount_due_ttc', '50.00');
        $response->assertJsonCount(1, 'data');
    }

    public function test_unpaid_status_csv_override(): void
    {
        $client = Client::create(['name' => 'CsvCo']);
        $this->createInvoice($client, 'FAC-1', Invoice::STATUS_SENT, '10.00');
        $this->createInvoice($client, 'FAC-2', Invoice::STATUS_VALIDATED, '20.00');
        $this->createInvoice($client, 'FAC-3', Invoice::STATUS_RELANCED, '40.00');

        $admin = User::factory()->labAdmin()->create();

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/invoices/unpaid?status=sent,relanced');

        $response->assertOk();
        $response->assertJsonPath('total_amount_due_ttc', '50.00');
        $response->assertJsonCount(2, 'data');
    }

    public function test_index_accepts_multi_status_array(): void
    {
        $client = Client::create(['name' => 'IdxCo']);
        $this->createInvoice($client, 'FAC-X-1', Invoice::STATUS_DRAFT, '1.00');
        $this->createInvoice($client, 'FAC-X-2', Invoice::STATUS_SENT, '2.00');

        $admin = User::factory()->labAdmin()->create();

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/invoices?status[]=draft&status[]=sent');

        $response->assertOk();
        $response->assertJsonCount(2, 'data');
    }

    public function test_pdf_link_returns_signed_url_for_allowed_user(): void
    {
        $client = Client::create(['name' => 'PdfCo']);
        $invoice = $this->createInvoice($client, 'FAC-PDF-1', Invoice::STATUS_SENT, '10.00');

        $user = User::factory()->forClient($client)->create([
            'role' => User::ROLE_CLIENT,
        ]);

        $response = $this->actingAs($user, 'sanctum')->getJson("/api/invoices/{$invoice->id}/pdf-link");

        $response->assertOk();
        $url = $response->json('url');
        $this->assertIsString($url);
        $this->assertStringContainsString('signature=', $url);

        $this->get($url)->assertOk();
    }

    public function test_pdf_link_forbidden_for_other_client_invoice(): void
    {
        $a = Client::create(['name' => 'A']);
        $b = Client::create(['name' => 'B']);
        $invoice = $this->createInvoice($a, 'FAC-ISO-1', Invoice::STATUS_SENT, '10.00');

        $intruder = User::factory()->forClient($b)->create([
            'role' => User::ROLE_CLIENT,
        ]);

        $this->actingAs($intruder, 'sanctum')
            ->getJson("/api/invoices/{$invoice->id}/pdf-link")
            ->assertForbidden();
    }

    public function test_signed_invoice_pdf_url_rejects_invalid_signature(): void
    {
        $client = Client::create(['name' => 'SigCo']);
        $invoice = $this->createInvoice($client, 'FAC-SIG-1', Invoice::STATUS_SENT, '10.00');

        $goodUrl = URL::temporarySignedRoute(
            'invoice.pdf.signed',
            now()->addMinutes(15),
            ['invoice' => $invoice->id]
        );
        $badUrl = preg_replace('/signature=[^&]+/', 'signature=invalid', (string) $goodUrl) ?? $goodUrl;

        $this->get($badUrl)->assertForbidden();
    }
}
