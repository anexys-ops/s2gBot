<?php

namespace App\Mail;

use App\Models\Invoice;
use App\Services\InvoicePdfGenerator;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class InvoiceEmailMailable extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly Invoice $invoice,
        public readonly string $recipientName,
        public readonly ?string $customMessage = null,
        public readonly ?string $senderName = null,
        public readonly ?int $pdfTemplateId = null,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Facture {$this->invoice->number} — ".\App\Support\AppDisplayName::resolve(),
        );
    }

    public function content(): Content
    {
        $this->invoice->loadMissing(['client', 'clientContact']);

        return new Content(
            view: 'emails.invoice',
            with: [
                'invoice' => $this->invoice,
                'recipientName' => $this->recipientName,
                'customMessage' => $this->customMessage,
                'senderName' => $this->senderName,
                'currencyLabel' => \App\Support\MoneyFormat::currencyLabel($this->invoice->currency_code),
                'brandName' => \App\Support\AppDisplayName::resolve(),
            ],
        );
    }

    /**
     * @return array<int, Attachment>
     */
    public function attachments(): array
    {
        [$bytes, $filename] = app(InvoicePdfGenerator::class)->generate($this->invoice, $this->pdfTemplateId);

        return [
            Attachment::fromData(fn () => $bytes, $filename)->withMime('application/pdf'),
        ];
    }
}
