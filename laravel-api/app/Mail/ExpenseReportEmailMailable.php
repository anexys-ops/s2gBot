<?php

namespace App\Mail;

use App\Models\ExpenseReport;
use App\Services\ExpenseReportPdfGenerator;
use App\Support\AppDisplayName;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ExpenseReportEmailMailable extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly ExpenseReport $report,
        public readonly string $recipientName,
        public readonly ?string $customMessage = null,
        public readonly ?string $senderName = null,
        public readonly ?int $pdfTemplateId = null,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Note de frais {$this->report->unique_number} — ".AppDisplayName::resolve(),
        );
    }

    public function content(): Content
    {
        $this->report->loadMissing(['ordreMission.client', 'ordreMission.dossier', 'lines']);
        $this->report->append('total');

        return new Content(
            view: 'emails.expense_report',
            with: [
                'report'        => $this->report,
                'recipientName' => $this->recipientName,
                'customMessage' => $this->customMessage,
                'senderName'    => $this->senderName,
                'brandName'     => AppDisplayName::resolve(),
                'currencyLabel' => config('app.currency_display', 'DH'),
            ],
        );
    }

    /**
     * @return array<int, Attachment>
     */
    public function attachments(): array
    {
        [$bytes, $filename] = app(ExpenseReportPdfGenerator::class)->generate($this->report, $this->pdfTemplateId);

        return [
            Attachment::fromData(fn () => $bytes, $filename)->withMime('application/pdf'),
        ];
    }
}
