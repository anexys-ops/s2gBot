<?php

namespace App\Services;

use App\Models\Client;
use App\Models\Invoice;
use App\Models\Quote;
use App\Models\User;
use App\Support\ActivityChangeTracker;

class DocumentActivityLogger
{
    public function __construct(private ActivityLogger $activityLogger) {}

    public function quoteCreated(User $user, Quote $quote): void
    {
        $quote->loadMissing('client');
        $this->activityLogger->log(
            $user,
            'quote.created',
            $quote,
            [
                'number' => $quote->number,
                'client_id' => $quote->client_id,
                'client_name' => $quote->client?->name,
            ],
            ActivityChangeTracker::buildDescription(
                'Devis',
                (int) $quote->id,
                $quote->number,
                'Création',
                $quote->client?->name,
            ),
        );
    }

    /**
     * @param  array<string, mixed>  $before
     * @param  list<string>  $tasks
     * @param  list<array<string, mixed>>  $lineChanges
     */
    public function quoteUpdated(User $user, Quote $quote, array $before, array $tasks = [], array $lineChanges = []): void
    {
        $quote->loadMissing('client');
        $after = $quote->only(array_keys($before));
        $changes = ActivityChangeTracker::diff($before, $after);
        $detailSummary = ActivityChangeTracker::buildDetailSummary($changes, $lineChanges);

        $this->activityLogger->log(
            $user,
            'quote.updated',
            $quote,
            [
                'number' => $quote->number,
                'client_id' => $quote->client_id,
                'client_name' => $quote->client?->name,
                'tasks' => $tasks,
                'changes' => $changes,
                'line_changes' => $lineChanges,
                'detail_summary' => $detailSummary,
            ],
            ActivityChangeTracker::buildDescription(
                'Devis',
                (int) $quote->id,
                $quote->number,
                'Modification',
                $quote->client?->name,
                $tasks,
                $detailSummary !== '' ? $detailSummary : null,
            ),
        );
    }

    public function quoteDeleted(User $user, Quote $quote): void
    {
        $quote->loadMissing('client');
        $this->activityLogger->log(
            $user,
            'quote.deleted',
            null,
            [
                'quote_id' => $quote->id,
                'number' => $quote->number,
                'client_id' => $quote->client_id,
                'client_name' => $quote->client?->name,
            ],
            ActivityChangeTracker::buildDescription(
                'Devis',
                (int) $quote->id,
                $quote->number,
                'Suppression',
                $quote->client?->name,
            ),
        );
    }

    public function quoteEmailed(User $user, Quote $quote, string $recipientEmail): void
    {
        $quote->loadMissing('client');
        $this->activityLogger->log(
            $user,
            'quote.emailed',
            $quote,
            [
                'number' => $quote->number,
                'recipient_email' => $recipientEmail,
                'client_name' => $quote->client?->name,
            ],
            ActivityChangeTracker::buildDescription(
                'Devis',
                (int) $quote->id,
                $quote->number,
                'Envoi e-mail',
                $quote->client?->name,
                ["destinataire: {$recipientEmail}"],
            ),
        );
    }

    public function invoiceCreated(User $user, Invoice $invoice): void
    {
        $invoice->loadMissing('client');
        $this->activityLogger->log(
            $user,
            'invoice.created',
            $invoice,
            [
                'number' => $invoice->number,
                'client_id' => $invoice->client_id,
                'client_name' => $invoice->client?->name,
            ],
            ActivityChangeTracker::buildDescription(
                'Facture',
                (int) $invoice->id,
                $invoice->number,
                'Création',
                $invoice->client?->name,
            ),
        );
    }

    /**
     * @param  array<string, mixed>  $before
     * @param  list<string>  $tasks
     * @param  list<array<string, mixed>>  $lineChanges
     */
    public function invoiceUpdated(User $user, Invoice $invoice, array $before, array $tasks = [], array $lineChanges = []): void
    {
        $invoice->loadMissing('client');
        $after = $invoice->only(array_keys($before));
        $changes = ActivityChangeTracker::diff($before, $after);
        $detailSummary = ActivityChangeTracker::buildDetailSummary($changes, $lineChanges);

        $this->activityLogger->log(
            $user,
            'invoice.updated',
            $invoice,
            [
                'number' => $invoice->number,
                'client_id' => $invoice->client_id,
                'client_name' => $invoice->client?->name,
                'tasks' => $tasks,
                'changes' => $changes,
                'line_changes' => $lineChanges,
                'detail_summary' => $detailSummary,
            ],
            ActivityChangeTracker::buildDescription(
                'Facture',
                (int) $invoice->id,
                $invoice->number,
                'Modification',
                $invoice->client?->name,
                $tasks,
                $detailSummary !== '' ? $detailSummary : null,
            ),
        );
    }

    public function invoiceDeleted(User $user, Invoice $invoice): void
    {
        $invoice->loadMissing('client');
        $this->activityLogger->log(
            $user,
            'invoice.deleted',
            null,
            [
                'invoice_id' => $invoice->id,
                'number' => $invoice->number,
                'client_id' => $invoice->client_id,
                'client_name' => $invoice->client?->name,
            ],
            ActivityChangeTracker::buildDescription(
                'Facture',
                (int) $invoice->id,
                $invoice->number,
                'Suppression',
                $invoice->client?->name,
            ),
        );
    }

    public function clientCreated(User $user, Client $client): void
    {
        $this->activityLogger->log(
            $user,
            'client.created',
            $client,
            ['name' => $client->name],
            ActivityChangeTracker::buildDescription('Client', (int) $client->id, $client->name, 'Création'),
        );
    }

    /**
     * @param  array<string, mixed>  $before
     */
    public function clientUpdated(User $user, Client $client, array $before): void
    {
        $after = $client->only(array_keys($before));
        $changes = ActivityChangeTracker::diff($before, $after);
        $detailSummary = ActivityChangeTracker::buildDetailSummary($changes);

        $this->activityLogger->log(
            $user,
            'client.updated',
            $client,
            [
                'name' => $client->name,
                'changes' => $changes,
                'detail_summary' => $detailSummary,
            ],
            ActivityChangeTracker::buildDescription(
                'Client',
                (int) $client->id,
                $client->name,
                'Modification',
                null,
                [],
                $detailSummary !== '' ? $detailSummary : null,
            ),
        );
    }

    public function clientDeleted(User $user, Client $client): void
    {
        $this->activityLogger->log(
            $user,
            'client.deleted',
            null,
            ['client_id' => $client->id, 'name' => $client->name],
            ActivityChangeTracker::buildDescription('Client', (int) $client->id, $client->name, 'Suppression'),
        );
    }
}
