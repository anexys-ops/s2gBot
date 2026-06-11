<?php

namespace App\Mail;

use App\Models\Quote;
use App\Services\QuotePdfGenerator;
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
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Devis {$this->quote->number} — " . config('app.name', 'Lab BTP'),
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.quote',
            with: [
                'quote'         => $this->quote,
                'recipientName' => $this->recipientName,
                'customMessage' => $this->customMessage,
                'currencyLabel' => config('app.currency_display', 'DH'),
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
