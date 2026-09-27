<?php

namespace App\Services;

use App\Models\TaskTestForm;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

class TaskTestFormExcelGenerator
{
    /** @return array{0: string, 1: string} contenu binaire, nom de fichier */
    public function generate(TaskTestForm $form): array
    {
        $data = TaskTestFormReportData::build($form);

        $spreadsheet = new Spreadsheet();
        $summary = $spreadsheet->getActiveSheet();
        $summary->setTitle('Résumé');

        $headerFill = [
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'EAF1FA']],
            'font' => ['bold' => true],
        ];

        $row = 1;
        $summary->setCellValue("A{$row}", $data['essai_name']);
        $summary->getStyle("A{$row}")->getFont()->setBold(true)->setSize(14);
        $row += 2;

        $infoPairs = array_filter([
            'Norme' => $data['norm'],
            'Dossier' => $data['dossier'],
            'Client' => $data['client'],
            'Chantier' => $data['chantier'],
            'Technicien' => $data['technicien'],
            'Tâche' => $data['task_number'],
            'Statut' => $data['status'],
            'Soumis le' => $data['submitted_at'],
        ]);
        foreach ($infoPairs as $label => $value) {
            $summary->setCellValue("A{$row}", $label);
            $summary->getStyle("A{$row}")->getFont()->setBold(true);
            $summary->setCellValue("B{$row}", (string) $value);
            $row++;
        }
        if ($data['description']) {
            $row++;
            $summary->setCellValue("A{$row}", 'Description');
            $summary->getStyle("A{$row}")->getFont()->setBold(true);
            $summary->setCellValue("B{$row}", $data['description']);
            $row++;
        }
        $row++;

        if ($data['scalar_rows'] !== []) {
            $summary->setCellValue("A{$row}", 'Paramètre');
            $summary->setCellValue("B{$row}", 'Valeur');
            $summary->setCellValue("C{$row}", 'Unité');
            $summary->getStyle("A{$row}:C{$row}")->applyFromArray($headerFill);
            $row++;
            foreach ($data['scalar_rows'] as $r) {
                $summary->setCellValue("A{$row}", $r['label']);
                $summary->setCellValue("B{$row}", $r['value']);
                $summary->setCellValue("C{$row}", $r['unit'] ?? '');
                $row++;
            }
        }
        foreach (['A', 'B', 'C'] as $col) {
            $summary->getColumnDimension($col)->setAutoSize(true);
        }

        foreach ($data['table_sections'] as $tableSection) {
            $sheetTitle = mb_substr(preg_replace('/[\\\\\/\?\*\[\]:]/', ' ', $tableSection['label']), 0, 31);
            $sheet = $spreadsheet->createSheet();
            $sheet->setTitle($sheetTitle ?: 'Détail');

            $columns = $tableSection['columns'];
            foreach ($columns as $colIndex => $column) {
                $colLetter = Coordinate::stringFromColumnIndex($colIndex + 1);
                $sheet->setCellValue("{$colLetter}1", $column['label'] ?? $column['key']);
                $sheet->getStyle("{$colLetter}1")->applyFromArray($headerFill);
            }
            $rowIndex = 2;
            foreach ($tableSection['rows'] as $dataRow) {
                foreach ($columns as $colIndex => $column) {
                    $colLetter = Coordinate::stringFromColumnIndex($colIndex + 1);
                    $value = $dataRow[$column['key']] ?? null;
                    $display = is_bool($value) ? ($value ? 'Oui' : 'Non') : ($value ?? '');
                    $sheet->setCellValue("{$colLetter}{$rowIndex}", $display);
                }
                $rowIndex++;
            }
            for ($i = 1; $i <= count($columns); $i++) {
                $sheet->getColumnDimension(Coordinate::stringFromColumnIndex($i))->setAutoSize(true);
            }
        }

        $spreadsheet->setActiveSheetIndex(0);

        $writer = new Xlsx($spreadsheet);
        $tmpPath = tempnam(sys_get_temp_dir(), 'ttf-excel-');
        $writer->save($tmpPath);
        $content = file_get_contents($tmpPath);
        unlink($tmpPath);

        return [$content, TaskTestFormReportData::filenameBase($data, $form).'.xlsx'];
    }
}
