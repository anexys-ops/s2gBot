<?php

namespace App\Mail;

use App\Models\Quote;
use App\Services\QuotePdfGenerator;
use App\Services\QuotePdfPresentationService;
use App\Support\AppBranding;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class QuoteEmailMailable extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly Quote $quote,
        public readonly string $recipientName,
        public readonly ?string $customMessage = null,
        public readonly ?string $senderName = null,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Devis {$this->quote->number} — " . \App\Support\AppDisplayName::resolve(),
        );
    }

    public function content(): Content
    {
        $presentation = app(QuotePdfPresentationService::class);
        $this->quote->loadMissing(['client', 'site', 'dossier']);

        return new Content(
            view: 'emails.quote',
            with: [
                'quote' => $this->quote,
                'recipientName' => $this->recipientName,
                'customMessage' => $this->customMessage,
                'senderName' => $this->senderName,
                'currencyLabel' => config('app.currency_display', 'DH'),
                'brandName' => \App\Support\AppDisplayName::resolve(),
                'pdfContext' => $presentation->buildContext($this->quote),
                'letterheadPath' => AppBranding::devisLetterheadAbsolutePath(),
            ],
        );
    }

    /**
     * @return array<int, Attachment>
     */
    public function attachments(): array
    {
        [$bytes, $filename] = app(QuotePdfGenerator::class)->generate($this->quote);

        return [
            Attachment::fromData(fn () => $bytes, $filename)->withMime('application/pdf'),
        ];
    }
}
