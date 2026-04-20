<?php

namespace Tests\Feature;

use App\Models\Agency;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\MailLog;
use App\Models\MailTemplate;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class InvoiceRelaunchCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_command_sends_reminder_and_updates_invoice(): void
    {
        Mail::fake();

        MailTemplate::updateOrCreate(
            ['name' => 'invoice_reminder'],
            [
                'subject' => 'Rappel {{invoice_number}}',
                'body' => 'Montant {{amount_ttc}}',
                'description' => 'test',
            ]
        );

        $client = Client::create([
            'name' => 'RelCo',
            'email' => 'compta@relco.test',
        ]);
        $agencyId = Agency::query()->where('client_id', $client->id)->where('is_headquarters', true)->value('id');

        $invoice = Invoice::create([
            'number' => 'FAC-REL-1',
            'client_id' => $client->id,
            'agency_id' => $agencyId,
            'invoice_date' => now()->subDays(20)->toDateString(),
            'due_date' => now()->subDays(5)->toDateString(),
            'amount_ht' => '100.00',
            'amount_ttc' => '120.00',
            'tva_rate' => '20.00',
            'status' => Invoice::STATUS_SENT,
            'reminder_count' => 0,
        ]);

        $this->artisan('invoices:relaunch-overdue')->assertSuccessful();

        $invoice->refresh();
        $this->assertSame(Invoice::STATUS_RELANCED, $invoice->status);
        $this->assertSame(1, $invoice->reminder_count);
        $this->assertNotNull($invoice->last_reminder_sent_at);

        $this->assertSame(1, MailLog::query()->where('template_name', 'invoice_reminder')->where('status', 'sent')->count());
    }
}
