<?php

use Illuminate\Support\Facades\Route;

Route::post('/login', [App\Http\Controllers\Api\AuthController::class, 'login']);
Route::post('/register', [App\Http\Controllers\Api\AuthController::class, 'register']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [App\Http\Controllers\Api\AuthController::class, 'logout']);
    Route::get('/user', [App\Http\Controllers\Api\AuthController::class, 'user']);

    Route::apiResource('clients', App\Http\Controllers\Api\ClientController::class);
    Route::apiResource('sites', App\Http\Controllers\Api\SiteController::class);
    Route::apiResource('test-types', App\Http\Controllers\Api\TestTypeController::class);
    Route::apiResource('orders', App\Http\Controllers\Api\OrderController::class);
    Route::get('orders/{order}/samples', [App\Http\Controllers\Api\SampleController::class, 'index']);
    Route::apiResource('samples', App\Http\Controllers\Api\SampleController::class)->except(['index']);
    Route::post('samples/{sample}/results', [App\Http\Controllers\Api\TestResultController::class, 'store']);
    Route::get('orders/{order}/results', [App\Http\Controllers\Api\TestResultController::class, 'byOrder']);
    Route::post('orders/{order}/reports', [App\Http\Controllers\Api\ReportController::class, 'generate']);
    Route::get('orders/{order}/reports', [App\Http\Controllers\Api\ReportController::class, 'index']);
    Route::get('reports/{report}/download', [App\Http\Controllers\Api\ReportController::class, 'download']);
    Route::post('invoices/from-orders', [App\Http\Controllers\Api\InvoiceController::class, 'fromOrders']);
    Route::apiResource('invoices', App\Http\Controllers\Api\InvoiceController::class);
    Route::apiResource('quotes', App\Http\Controllers\Api\QuoteController::class);
    Route::get('pdf/templates', [App\Http\Controllers\Api\PdfController::class, 'templates']);
    Route::post('pdf/generate', [App\Http\Controllers\Api\PdfController::class, 'generate']);
    Route::get('mail/templates', [App\Http\Controllers\Api\MailController::class, 'templates']);
    Route::get('mail/logs', [App\Http\Controllers\Api\MailController::class, 'logs']);
    Route::post('mail/send', [App\Http\Controllers\Api\MailController::class, 'send']);

    // LIMS BTP — Cadrage (Semaine 0) et exemples de calculs
    Route::get('cadrage', [App\Http\Controllers\Api\CadrageController::class, 'show']);
    Route::put('cadrage', [App\Http\Controllers\Api\CadrageController::class, 'update']);
    Route::get('btp-calculations/exemples', [App\Http\Controllers\Api\BtpCalculationController::class, 'exemples']);
    Route::post('btp-calculations/calculer', [App\Http\Controllers\Api\BtpCalculationController::class, 'calculer']);
    Route::get('stats/essais', [App\Http\Controllers\Api\StatsController::class, 'essais']);
});
