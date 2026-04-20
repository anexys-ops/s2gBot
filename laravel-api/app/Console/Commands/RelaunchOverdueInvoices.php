<?php

namespace App\Console\Commands;

use App\Models\Client;
use App\Models\Invoice;
use App\Models\MailLog;
use App\Models\MailTemplate;
use App\Models\ModuleSetting;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

class RelaunchOverdueInvoices extends Command
{
    protected $signature = 'invoices:relaunch-overdue {--dry-run : Affiche les factures sans envoyer}';

    protected $description = 'Relance les factures en retard (statut + e-mail modèle invoice_reminder)';

    public function handle(): int
    {
        $settings = ModuleSetting::query()->where('module_key', 'invoice_reminders')->value('settings') ?? [];
        $enabled = (bool) ($settings['enabled'] ?? true);
        if (! $enabled) {
            $this->info('Relances désactivées (module_settings.invoice_reminders.enabled).');

            return self::SUCCESS;
        }

        $minDays = max(1, (int) ($settings['min_days_between'] ?? 7));
        $maxPerInvoice = max(1, (int) ($settings['max_reminders_per_invoice'] ?? 12));

        $statuses = [
            Invoice::STATUS_VALIDATED,
            Invoice::STATUS_SIGNED,
            Invoice::STATUS_SENT,
            Invoice::STATUS_RELANCED,
        ];

        $query = Invoice::query()
            ->with('client')
            ->whereIn('status', $statuses)
            ->whereNotNull('due_date')
            ->whereDate('due_date', '<', now()->toDateString())
            ->where('reminder_count', '<', $maxPerInvoice)
            ->where(function ($q) use ($minDays) {
                $q->whereNull('last_reminder_sent_at')
                    ->orWhere('last_reminder_sent_at', '<', now()->subDays($minDays));
            });

        $count = 0;
        foreach ($query->cursor() as $invoice) {
            if ($this->option('dry-run')) {
                $this->line("DRY-RUN facture #{$invoice->id} {$invoice->number}");
                $count++;

                continue;
            }

            $this->processInvoice($invoice);
            $count++;
        }

        $this->info("Traité {$count} facture(s).");

        return self::SUCCESS;
    }

    private function processInvoice(Invoice $invoice): void
    {
        $client = $invoice->client;
        $to = $client instanceof Client ? trim((string) ($client->email ?? '')) : '';

        $template = MailTemplate::query()->where('name', 'invoice_reminder')->first();
        $subject = $template?->subject ?? 'Rappel facture {{invoice_number}}';
        $body = $template?->body ?? "Bonjour,\n\nLa facture {{invoice_number}} est en retard (échéance {{due_date}}).\n\nCordialement";

        $replacements = [
            '{{invoice_number}}' => $invoice->number,
            '{{due_date}}' => $invoice->due_date?->format('Y-m-d') ?? '',
            '{{amount_ttc}}' => (string) $invoice->amount_ttc,
        ];
        foreach ($replacements as $k => $v) {
            $subject = str_replace($k, $v, $subject);
            $body = str_replace($k, $v, $body);
        }

        if ($to === '') {
            MailLog::create([
                'to' => '',
                'subject' => $subject,
                'template_name' => 'invoice_reminder',
                'status' => 'failed',
                'error_message' => 'Client sans e-mail',
                'user_id' => null,
                'sent_at' => now(),
            ]);
            $this->warn("Facture {$invoice->number} : client sans e-mail, relance reportée.");

            return;
        }

        try {
            Mail::raw($body, function ($message) use ($to, $subject) {
                $message->to($to)->subject($subject);
            });
            MailLog::create([
                'to' => $to,
                'subject' => $subject,
                'template_name' => 'invoice_reminder',
                'status' => 'sent',
                'user_id' => null,
                'sent_at' => now(),
            ]);
        } catch (\Throwable $e) {
            MailLog::create([
                'to' => $to,
                'subject' => $subject,
                'template_name' => 'invoice_reminder',
                'status' => 'failed',
                'error_message' => $e->getMessage(),
                'user_id' => null,
                'sent_at' => now(),
            ]);
            $this->warn("Facture {$invoice->number} : échec envoi ({$e->getMessage()}).");

            return;
        }

        $invoice->update([
            'status' => Invoice::STATUS_RELANCED,
            'last_reminder_sent_at' => now(),
            'reminder_count' => $invoice->reminder_count + 1,
        ]);

        $this->line("Relance envoyée : {$invoice->number}");
    }
}
