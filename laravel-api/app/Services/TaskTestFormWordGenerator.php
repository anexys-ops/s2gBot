<?php

namespace App\Services;

use App\Models\TaskTestForm;
use Illuminate\Support\Facades\Storage;
use PhpOffice\PhpWord\IOFactory;
use PhpOffice\PhpWord\PhpWord;
use PhpOffice\PhpWord\SimpleType\Jc;

class TaskTestFormWordGenerator
{
    /** @return array{0: string, 1: string} contenu binaire, nom de fichier */
    public function generate(TaskTestForm $form): array
    {
        $data = TaskTestFormReportData::build($form);

        $phpWord = new PhpWord();
        $phpWord->setDefaultFontName('Calibri');
        $phpWord->setDefaultFontSize(10);

        $titleStyle = ['bold' => true, 'size' => 16];
        $sectionStyle = ['bold' => true, 'size' => 12, 'spaceBefore' => 240];
        $tableStyle = ['borderSize' => 6, 'borderColor' => '999999', 'cellMargin' => 80];
        $headerCellStyle = ['bgColor' => 'EAF1FA'];

        $section = $phpWord->addSection();

        $section->addText($data['essai_name'], $titleStyle);
        if ($data['norm']) {
            $section->addText('Norme : '.$data['norm'], ['italic' => true]);
        }
        if ($data['description']) {
            $section->addText($data['description'], [], ['spaceAfter' => 120]);
        }

        $infoTable = $section->addTable($tableStyle);
        $infoPairs = array_filter([
            'Dossier' => $data['dossier'],
            'Client' => $data['client'],
            'Chantier' => $data['chantier'],
            'Technicien' => $data['technicien'],
            'Tâche' => $data['task_number'],
            'Statut' => $data['status'],
            'Soumis le' => $data['submitted_at'],
        ]);
        foreach (array_chunk($infoPairs, 2, true) as $chunk) {
            $infoTable->addRow();
            foreach ($chunk as $label => $value) {
                $infoTable->addCell(2500, $headerCellStyle)->addText($label, ['bold' => true]);
                $infoTable->addCell(2500)->addText((string) $value);
            }
            if (count($chunk) === 1) {
                $infoTable->addCell(2500, $headerCellStyle);
                $infoTable->addCell(2500);
            }
        }

        if ($data['scalar_rows'] !== []) {
            $section->addText('Résultats', $sectionStyle);
            $resultsTable = $section->addTable($tableStyle);
            $resultsTable->addRow();
            $resultsTable->addCell(4500, $headerCellStyle)->addText('Paramètre', ['bold' => true]);
            $resultsTable->addCell(4500, $headerCellStyle)->addText('Valeur', ['bold' => true]);
            foreach ($data['scalar_rows'] as $row) {
                $resultsTable->addRow();
                $labelCell = $resultsTable->addCell(4500);
                $labelCell->addText($row['label']);
                if ($row['help']) {
                    $labelCell->addText($row['help'], ['italic' => true, 'size' => 8, 'color' => '666666']);
                }
                $valueText = $row['value'].($row['unit'] ? ' '.$row['unit'] : '');
                $resultsTable->addCell(4500)->addText($valueText);
            }
        }

        foreach ($data['table_sections'] as $tableSection) {
            $section->addText($tableSection['label'], $sectionStyle);
            if ($tableSection['rows'] === []) {
                $section->addText('Aucune ligne renseignée.', ['italic' => true]);
                continue;
            }
            $columns = $tableSection['columns'];
            $columnWidth = (int) floor(9000 / max(count($columns), 1));
            $dataTable = $section->addTable($tableStyle);
            $dataTable->addRow();
            foreach ($columns as $column) {
                $dataTable->addCell($columnWidth, $headerCellStyle)->addText($column['label'] ?? $column['key'], ['bold' => true]);
            }
            foreach ($tableSection['rows'] as $row) {
                $dataTable->addRow();
                foreach ($columns as $column) {
                    $value = $row[$column['key']] ?? null;
                    $display = is_bool($value) ? ($value ? 'Oui' : 'Non') : (string) ($value ?? '—');
                    $dataTable->addCell($columnWidth)->addText($display);
                }
            }
        }

        $photos = $data['photos'];
        if ($photos->isNotEmpty()) {
            $section->addText('Photos', $sectionStyle);
            foreach ($photos as $photo) {
                $path = Storage::disk('local')->path($photo->path);
                if (is_file($path)) {
                    try {
                        $maxWidth = 320;
                        $size = @getimagesize($path);
                        $width = $maxWidth;
                        $height = $size ? (int) round($maxWidth * $size[1] / $size[0]) : 240;
                        $section->addImage($path, ['width' => $width, 'height' => $height, 'alignment' => Jc::CENTER]);
                    } catch (\Throwable) {
                        $section->addText('(photo illisible : '.$photo->original_name.')');
                    }
                }
                $section->addText($photo->original_name, ['size' => 8, 'color' => '666666'], ['alignment' => Jc::CENTER]);
            }
        }

        $writer = IOFactory::createWriter($phpWord, 'Word2007');
        $tmpPath = tempnam(sys_get_temp_dir(), 'ttf-word-');
        $writer->save($tmpPath);
        $content = file_get_contents($tmpPath);
        unlink($tmpPath);

        return [$content, TaskTestFormReportData::filenameBase($data, $form).'.docx'];
    }
}
