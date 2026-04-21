<?php

namespace App\Console\Commands;

use App\Models\Calibration;
use App\Models\Equipment;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\Quote;
use App\Models\Report;
use App\Models\Sample;
use App\Models\Site;
use Illuminate\Console\Command;

class GenerateTsEnums extends Command
{
    protected $signature = 'generate:ts-enums {--path= : Chemin relatif depuis la racine du monorepo}';

    protected $description = 'Génère les enums TypeScript partagés à partir des statuts Laravel';

    public function handle(): int
    {
        $root = dirname(base_path());
        $relativePath = trim((string) $this->option('path'));
        if ($relativePath === '') {
            $relativePath = 'react-frontend/src/types/enums.ts';
        }
        $relativePath = ltrim(str_replace('\\', '/', $relativePath), '/');
        $targetPath = $root.'/'.$relativePath;

        $targetDir = dirname($targetPath);
        if (! is_dir($targetDir) && ! mkdir($targetDir, 0775, true) && ! is_dir($targetDir)) {
            $this->error("Impossible de créer le dossier : {$targetDir}");

            return self::FAILURE;
        }

        $content = $this->renderTypescript();
        if (file_put_contents($targetPath, $content) === false) {
            $this->error("Impossible d'écrire le fichier : {$targetPath}");

            return self::FAILURE;
        }

        $this->info("Enums TypeScript générés : {$targetPath}");

        return self::SUCCESS;
    }

    private function renderTypescript(): string
    {
        $groups = [
            'ORDER_STATUSES' => [
                Order::STATUS_DRAFT,
                Order::STATUS_SUBMITTED,
                Order::STATUS_IN_PROGRESS,
                Order::STATUS_COMPLETED,
            ],
            'INVOICE_STATUSES' => Invoice::statuses(),
            'QUOTE_STATUSES' => Quote::statuses(),
            'SAMPLE_STATUSES' => [
                Sample::STATUS_PENDING,
                Sample::STATUS_RECEIVED,
                Sample::STATUS_IN_PROGRESS,
                Sample::STATUS_TESTED,
                Sample::STATUS_VALIDATED,
            ],
            'SITE_STATUSES' => Site::STATUSES,
            'EQUIPMENT_STATUSES' => [
                Equipment::STATUS_ACTIVE,
                Equipment::STATUS_MAINTENANCE,
                Equipment::STATUS_RETIRED,
            ],
            'REPORT_REVIEW_STATUSES' => [
                Report::REVIEW_DRAFT,
                Report::REVIEW_PENDING,
                Report::REVIEW_APPROVED,
            ],
            'CALIBRATION_RESULTS' => [
                Calibration::RESULT_OK,
                Calibration::RESULT_OK_WITH_RESERVE,
                Calibration::RESULT_FAILED,
            ],
        ];

        $lines = [];
        $lines[] = '/**';
        $lines[] = ' * Généré par `php artisan generate:ts-enums`.';
        $lines[] = ' * Source de vérité : constantes des modèles Laravel.';
        $lines[] = ' */';
        $lines[] = '';

        foreach ($groups as $constName => $values) {
            $lines[] = "export const {$constName} = [";
            foreach ($values as $value) {
                $safe = addslashes((string) $value);
                $lines[] = "  '{$safe}',";
            }
            $lines[] = '] as const';

            $typeName = $this->toTypeName($constName);
            $lines[] = '';
            $lines[] = "export type {$typeName} = (typeof {$constName})[number]";
            $lines[] = '';
        }

        return rtrim(implode("\n", $lines))."\n";
    }

    private function toTypeName(string $constName): string
    {
        $base = str_replace(' ', '', ucwords(strtolower(str_replace('_', ' ', $constName))));
        if (str_ends_with($base, 'Statuses')) {
            return substr($base, 0, -2);
        }
        if (str_ends_with($base, 'Results')) {
            return substr($base, 0, -1);
        }

        return $base;
    }
}
