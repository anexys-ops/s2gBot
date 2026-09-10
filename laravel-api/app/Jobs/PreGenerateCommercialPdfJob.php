<?php

namespace App\Jobs;

use App\Models\BonCommande;
use App\Models\Quote;
use App\Services\BonCommandePdfGenerator;
use App\Services\QuotePdfGenerator;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Support\Facades\Log;

/**
 * Pré-génère un PDF commercial en arrière-plan (après réponse HTTP) pour un aperçu quasi instantané.
 */
class PreGenerateCommercialPdfJob
{
    use Dispatchable;

    public function __construct(
        public readonly string $documentType,
        public readonly int $documentId,
        public readonly ?int $templateId = null,
    ) {}

    public function handle(QuotePdfGenerator $quotePdfGenerator, BonCommandePdfGenerator $bonCommandePdfGenerator): void
    {
        try {
            match ($this->documentType) {
                'quote' => $this->warmQuote($quotePdfGenerator),
                'purchase_order' => $this->warmBonCommande($bonCommandePdfGenerator),
                default => null,
            };
        } catch (\Throwable $e) {
            Log::warning('Pré-génération PDF échouée', [
                'document_type' => $this->documentType,
                'document_id' => $this->documentId,
                'template_id' => $this->templateId,
                'message' => $e->getMessage(),
            ]);
        }
    }

    private function warmQuote(QuotePdfGenerator $generator): void
    {
        $quote = Quote::query()->find($this->documentId);
        if ($quote === null) {
            return;
        }

        $generator->generate($quote, $this->templateId);
    }

    private function warmBonCommande(BonCommandePdfGenerator $generator): void
    {
        $bc = BonCommande::query()->find($this->documentId);
        if ($bc === null) {
            return;
        }

        $generator->generate($bc, $this->templateId);
    }
}
