<?php

namespace App\Services;

use App\Jobs\PreGenerateCommercialPdfJob;
use App\Models\DocumentPdfTemplate;
use App\Models\Quote;

final class CommercialPdfPreGenerationService
{
    /**
     * Lance la pré-génération PDF du devis après envoi de la réponse HTTP (sans worker queue).
     *
     * @return list<int> identifiants de modèles planifiés
     */
    public function warmQuote(Quote $quote): array
    {
        $scheduled = [];

        foreach ($this->templateIdsForQuote($quote) as $templateId) {
            PreGenerateCommercialPdfJob::dispatch('quote', (int) $quote->id, $templateId)->afterResponse();
            $scheduled[] = $templateId;
        }

        return $scheduled;
    }

    /**
     * @return list<int>
     */
    private function templateIdsForQuote(Quote $quote): array
    {
        $ids = [];

        if ($quote->pdf_template_id) {
            $assigned = DocumentPdfTemplate::query()
                ->where('id', (int) $quote->pdf_template_id)
                ->where('document_type', 'quote')
                ->where('is_active', true)
                ->value('id');
            if ($assigned !== null) {
                $ids[] = (int) $assigned;
            }
        }

        $defaultId = DocumentPdfTemplate::query()
            ->where('document_type', 'quote')
            ->where('is_default', true)
            ->where('is_active', true)
            ->value('id');
        if ($defaultId !== null) {
            $ids[] = (int) $defaultId;
        }

        if ($ids === []) {
            $fallbackId = DocumentPdfTemplate::query()
                ->where('document_type', 'quote')
                ->where('is_active', true)
                ->orderBy('id')
                ->value('id');
            if ($fallbackId !== null) {
                $ids[] = (int) $fallbackId;
            }
        }

        return array_values(array_unique($ids));
    }
}
