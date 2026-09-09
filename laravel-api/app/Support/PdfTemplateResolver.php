<?php

namespace App\Support;

use App\Models\DocumentPdfTemplate;

class PdfTemplateResolver
{
    /** @var list<string> */
    public const DOCUMENT_TYPES = [
        'quote',
        'invoice',
        'report',
        'purchase_order',
        'delivery_note',
        'expense_report',
    ];

    public static function resolve(string $documentType, ?int $requestTemplateId, ?int $modelTemplateId = null): ?DocumentPdfTemplate
    {
        if ($requestTemplateId) {
            return DocumentPdfTemplate::query()
                ->where('id', $requestTemplateId)
                ->where('document_type', $documentType)
                ->where('is_active', true)
                ->first();
        }

        if ($modelTemplateId) {
            $t = DocumentPdfTemplate::query()
                ->where('id', $modelTemplateId)
                ->where('document_type', $documentType)
                ->where('is_active', true)
                ->first();
            if ($t) {
                return $t;
            }
        }

        return DocumentPdfTemplate::query()
            ->where('document_type', $documentType)
            ->where('is_default', true)
            ->where('is_active', true)
            ->first();
    }

    public static function layoutConfig(?DocumentPdfTemplate $template): array
    {
        return AppBranding::mergeLayoutConfig($template?->layout_config);
    }

    /** @return list<string> */
    public static function bladeViewsForType(string $documentType): array
    {
        return match ($documentType) {
            'quote' => ['pdf.quote', 'pdf.quote_detailed'],
            'invoice' => ['pdf.invoice', 'pdf.invoice_detailed'],
            'report' => ['reports.order', 'pdf.examples.synthese', 'pdf.examples.granulometrie', 'pdf.examples.compression'],
            'purchase_order' => ['pdf.purchase_order'],
            'delivery_note' => ['pdf.delivery_note'],
            'expense_report' => ['pdf.expense_report'],
            default => [],
        };
    }

    public static function defaultBladeView(string $documentType): string
    {
        $views = self::bladeViewsForType($documentType);

        return $views[0] ?? 'pdf.quote';
    }
}
