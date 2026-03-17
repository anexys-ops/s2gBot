<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Report;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Storage;

class ReportService
{
    public function generate(Order $order): Report
    {
        $order->load(['client', 'site', 'orderItems.testType.params', 'orderItems.samples.testResults.testTypeParam']);

        $html = view('reports.order', ['order' => $order])->render();

        $filename = 'rapport-'.$order->reference.'-'.now()->format('Y-m-d-His').'.pdf';
        $path = 'reports/'.$filename;

        $pdf = Pdf::loadHTML($html);
        $pdf->getDomPDF()->setPaper('A4', 'portrait');
        $content = $pdf->output();

        Storage::disk('local')->put($path, $content);

        $report = Report::create([
            'order_id' => $order->id,
            'file_path' => $path,
            'filename' => $filename,
            'generated_at' => now(),
        ]);

        return $report;
    }
}
