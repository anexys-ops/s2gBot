<?php

use Illuminate\Support\Facades\Route;

Route::post('/login', [App\Http\Controllers\Api\AuthController::class, 'login']);
Route::post('/register', [App\Http\Controllers\Api\AuthController::class, 'register']);
Route::get('/register/clients', [App\Http\Controllers\Api\AuthController::class, 'registerClientList']);
Route::get('/register/sites', [App\Http\Controllers\Api\AuthController::class, 'registerSiteList']);
Route::get('/register/agencies', [App\Http\Controllers\Api\AuthController::class, 'registerAgencyList']);
Route::get('/version', [App\Http\Controllers\Api\VersionController::class, 'show']);
Route::get('/openapi.json', [App\Http\Controllers\Api\OpenApiController::class, 'show']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [App\Http\Controllers\Api\AuthController::class, 'logout']);
    Route::get('/user', [App\Http\Controllers\Api\AuthController::class, 'user']);

    Route::put('user/profile', [App\Http\Controllers\Api\AccountController::class, 'updateProfile']);
    Route::put('user/password', [App\Http\Controllers\Api\AccountController::class, 'updatePassword']);
    Route::get('user/api-tokens', [App\Http\Controllers\Api\AccountController::class, 'listApiTokens']);
    Route::post('user/api-tokens', [App\Http\Controllers\Api\AccountController::class, 'createApiToken']);
    Route::delete('user/api-tokens/{tokenId}', [App\Http\Controllers\Api\AccountController::class, 'revokeApiToken'])->whereNumber('tokenId');
    Route::get('permissions/catalog', [App\Http\Controllers\Api\AccountController::class, 'permissionCatalog']);

    Route::prefix('admin')->group(function () {
        Route::get('activity-logs', [App\Http\Controllers\Api\ActivityLogController::class, 'indexAll']);
        Route::apiResource('users', App\Http\Controllers\Api\UserManagementController::class);
        Route::apiResource('access-groups', App\Http\Controllers\Api\AccessGroupController::class);
    });

    Route::apiResource('clients', App\Http\Controllers\Api\ClientController::class);
    Route::get('clients/{client}/agencies', [App\Http\Controllers\Api\AgencyController::class, 'index']);
    Route::post('clients/{client}/agencies', [App\Http\Controllers\Api\AgencyController::class, 'store']);
    Route::get('agencies/{agency}', [App\Http\Controllers\Api\AgencyController::class, 'show']);
    Route::put('agencies/{agency}', [App\Http\Controllers\Api\AgencyController::class, 'update']);
    Route::delete('agencies/{agency}', [App\Http\Controllers\Api\AgencyController::class, 'destroy']);
    Route::get('clients/{client}/commercial-overview', [App\Http\Controllers\Api\ClientCommercialController::class, 'overview']);
    Route::get('clients/{client}/addresses', [App\Http\Controllers\Api\ClientAddressController::class, 'index']);
    Route::post('clients/{client}/addresses', [App\Http\Controllers\Api\ClientAddressController::class, 'store']);
    Route::put('client-addresses/{client_address}', [App\Http\Controllers\Api\ClientAddressController::class, 'update']);
    Route::delete('client-addresses/{client_address}', [App\Http\Controllers\Api\ClientAddressController::class, 'destroy']);
    Route::apiResource('sites', App\Http\Controllers\Api\SiteController::class);
    Route::get('sites/{site}/missions', [App\Http\Controllers\Api\MissionController::class, 'index']);
    Route::post('sites/{site}/missions', [App\Http\Controllers\Api\MissionController::class, 'store']);
    Route::get('missions/{mission}', [App\Http\Controllers\Api\MissionController::class, 'show']);
    Route::patch('missions/{mission}', [App\Http\Controllers\Api\MissionController::class, 'update']);
    Route::delete('missions/{mission}', [App\Http\Controllers\Api\MissionController::class, 'destroy']);
    Route::get('missions/{mission}/boreholes', [App\Http\Controllers\Api\BoreholeController::class, 'index']);
    Route::post('missions/{mission}/boreholes', [App\Http\Controllers\Api\BoreholeController::class, 'store']);
    Route::get('boreholes/{borehole}', [App\Http\Controllers\Api\BoreholeController::class, 'show']);
    Route::patch('boreholes/{borehole}', [App\Http\Controllers\Api\BoreholeController::class, 'update']);
    Route::delete('boreholes/{borehole}', [App\Http\Controllers\Api\BoreholeController::class, 'destroy']);
    Route::get('boreholes/{borehole}/lithology-layers', [App\Http\Controllers\Api\LithologyLayerController::class, 'index']);
    Route::post('boreholes/{borehole}/lithology-layers', [App\Http\Controllers\Api\LithologyLayerController::class, 'store']);
    Route::get('lithology-layers/{lithology_layer}', [App\Http\Controllers\Api\LithologyLayerController::class, 'show']);
    Route::patch('lithology-layers/{lithology_layer}', [App\Http\Controllers\Api\LithologyLayerController::class, 'update']);
    Route::delete('lithology-layers/{lithology_layer}', [App\Http\Controllers\Api\LithologyLayerController::class, 'destroy']);
    Route::apiResource('test-types', App\Http\Controllers\Api\TestTypeController::class);
    Route::apiResource('equipments', App\Http\Controllers\Api\EquipmentController::class);
    Route::get('equipments/{equipment}/calibrations', [App\Http\Controllers\Api\CalibrationController::class, 'index']);
    Route::post('equipments/{equipment}/calibrations', [App\Http\Controllers\Api\CalibrationController::class, 'store']);
    Route::get('equipments/{equipment}/calibrations/{calibration}', [App\Http\Controllers\Api\CalibrationController::class, 'show']);
    Route::put('equipments/{equipment}/calibrations/{calibration}', [App\Http\Controllers\Api\CalibrationController::class, 'update']);
    Route::patch('equipments/{equipment}/calibrations/{calibration}', [App\Http\Controllers\Api\CalibrationController::class, 'update']);
    Route::delete('equipments/{equipment}/calibrations/{calibration}', [App\Http\Controllers\Api\CalibrationController::class, 'destroy']);
    Route::apiResource('orders', App\Http\Controllers\Api\OrderController::class);
    Route::get('orders/{order}/samples', [App\Http\Controllers\Api\SampleController::class, 'index']);
    Route::apiResource('samples', App\Http\Controllers\Api\SampleController::class)->except(['index']);
    Route::post('samples/{sample}/results', [App\Http\Controllers\Api\TestResultController::class, 'store']);
    Route::get('orders/{order}/results', [App\Http\Controllers\Api\TestResultController::class, 'byOrder']);
    Route::post('orders/{order}/reports', [App\Http\Controllers\Api\ReportController::class, 'generate']);
    Route::get('orders/{order}/reports', [App\Http\Controllers\Api\ReportController::class, 'index']);
    Route::get('reports/{report}/download', [App\Http\Controllers\Api\ReportController::class, 'download']);
    Route::get('reports/{report}/versions', [App\Http\Controllers\Api\ReportController::class, 'versions']);
    Route::get('reports/{report}/pdf-link', [App\Http\Controllers\Api\ReportController::class, 'pdfLink']);
    Route::post('reports/{report}/sign', [App\Http\Controllers\Api\ReportController::class, 'sign']);
    Route::post('reports/{report}/submit-review', [App\Http\Controllers\Api\ReportController::class, 'submitReview']);
    Route::post('reports/{report}/approve-review', [App\Http\Controllers\Api\ReportController::class, 'approveReview']);
    Route::get('branding', [App\Http\Controllers\Api\AppBrandingController::class, 'show']);
    Route::post('branding/logo', [App\Http\Controllers\Api\AppBrandingController::class, 'uploadLogo']);
    Route::delete('branding/logo', [App\Http\Controllers\Api\AppBrandingController::class, 'destroyLogo']);

    Route::get('report-pdf-templates', [App\Http\Controllers\Api\ReportPdfTemplateController::class, 'index']);
    Route::put('report-pdf-templates/{report_pdf_template}', [App\Http\Controllers\Api\ReportPdfTemplateController::class, 'update']);
    Route::get('report-form-definitions', [App\Http\Controllers\Api\ReportFormDefinitionController::class, 'index']);
    Route::post('invoices/from-orders', [App\Http\Controllers\Api\InvoiceController::class, 'fromOrders']);
    Route::get('invoices/unpaid', [App\Http\Controllers\Api\InvoiceController::class, 'unpaid']);
    Route::get('invoices/{invoice}/pdf-link', [App\Http\Controllers\Api\InvoiceController::class, 'pdfLink']);
    Route::apiResource('invoices', App\Http\Controllers\Api\InvoiceController::class);
    Route::apiResource('quotes', App\Http\Controllers\Api\QuoteController::class);
    Route::apiResource('commercial-offerings', App\Http\Controllers\Api\CommercialOfferingController::class);
    Route::get('pdf/templates', [App\Http\Controllers\Api\PdfController::class, 'templates']);
    Route::post('pdf/generate', [App\Http\Controllers\Api\PdfController::class, 'generate']);
    Route::get('pdf/examples/{slug}', [App\Http\Controllers\Api\ExamplePdfController::class, 'download']);
    Route::get('mail/templates', [App\Http\Controllers\Api\MailController::class, 'templates']);
    Route::apiResource('mail-templates', App\Http\Controllers\Api\MailTemplateController::class)->only(['index', 'store', 'update', 'destroy']);
    Route::get('mail/logs', [App\Http\Controllers\Api\MailController::class, 'logs']);
    Route::post('mail/send', [App\Http\Controllers\Api\MailController::class, 'send']);

    // LIMS BTP — Cadrage (Semaine 0) et exemples de calculs
    Route::get('cadrage', [App\Http\Controllers\Api\CadrageController::class, 'show']);
    Route::put('cadrage', [App\Http\Controllers\Api\CadrageController::class, 'update']);
    Route::get('btp-calculations/exemples', [App\Http\Controllers\Api\BtpCalculationController::class, 'exemples']);
    Route::post('btp-calculations/calculer', [App\Http\Controllers\Api\BtpCalculationController::class, 'calculer']);
    Route::post('btp-calculations/granulometry', [App\Http\Controllers\Api\BtpCalculationController::class, 'granulometry']);
    Route::get('activity-logs', [App\Http\Controllers\Api\ActivityLogController::class, 'index']);
    Route::get('stats/essais', [App\Http\Controllers\Api\StatsController::class, 'essais']);
    Route::get('stats/dashboard', [App\Http\Controllers\Api\StatsController::class, 'dashboard']);
    Route::get('accounting/exports', [App\Http\Controllers\Api\AccountingExportController::class, 'export']);

    Route::get('attachments', [App\Http\Controllers\Api\AttachmentController::class, 'index']);
    Route::post('attachments', [App\Http\Controllers\Api\AttachmentController::class, 'store']);
    Route::get('attachments/{attachment}/download', [App\Http\Controllers\Api\AttachmentController::class, 'download']);
    Route::delete('attachments/{attachment}', [App\Http\Controllers\Api\AttachmentController::class, 'destroy']);

    Route::get('commercial-links', [App\Http\Controllers\Api\CommercialDocumentLinkController::class, 'index']);
    Route::post('commercial-links', [App\Http\Controllers\Api\CommercialDocumentLinkController::class, 'store']);
    Route::delete('commercial-links/{commercial_document_link}', [App\Http\Controllers\Api\CommercialDocumentLinkController::class, 'destroy']);

    Route::get('document-pdf-templates', [App\Http\Controllers\Api\DocumentPdfTemplateController::class, 'index']);
    Route::put('document-pdf-templates/{document_pdf_template}', [App\Http\Controllers\Api\DocumentPdfTemplateController::class, 'update']);

    Route::get('extrafield-definitions', [App\Http\Controllers\Api\ExtrafieldDefinitionController::class, 'index']);
    Route::post('extrafield-definitions', [App\Http\Controllers\Api\ExtrafieldDefinitionController::class, 'store']);
    Route::put('extrafield-definitions/{extrafield_definition}', [App\Http\Controllers\Api\ExtrafieldDefinitionController::class, 'update']);
    Route::delete('extrafield-definitions/{extrafield_definition}', [App\Http\Controllers\Api\ExtrafieldDefinitionController::class, 'destroy']);
    Route::get('extrafield-values', [App\Http\Controllers\Api\ExtrafieldValueController::class, 'index']);
    Route::put('extrafield-values', [App\Http\Controllers\Api\ExtrafieldValueController::class, 'sync']);

    Route::get('module-settings/{module_key}', [App\Http\Controllers\Api\ModuleSettingController::class, 'show']);
    Route::put('module-settings/{module_key}', [App\Http\Controllers\Api\ModuleSettingController::class, 'update']);

    // App mobile laboratoire / terrain — dossiers (mesures + photos)
    Route::prefix('mobile/dossiers')->group(function () {
        Route::get('{kind}/{id}/measure-forms', [App\Http\Controllers\Api\Mobile\MobileDossierController::class, 'measureForms'])
            ->where('kind', 'order|site')
            ->whereNumber('id');
        Route::post('{kind}/{id}/measure-submissions', [App\Http\Controllers\Api\Mobile\MobileDossierController::class, 'storeMeasureSubmission'])
            ->where('kind', 'order|site')
            ->whereNumber('id');
        Route::get('{kind}/{id}/photos', [App\Http\Controllers\Api\Mobile\MobileDossierController::class, 'photos'])
            ->where('kind', 'order|site')
            ->whereNumber('id');
        Route::post('{kind}/{id}/photos', [App\Http\Controllers\Api\Mobile\MobileDossierController::class, 'storePhotoMeta'])
            ->where('kind', 'order|site')
            ->whereNumber('id');
    });
});

Route::middleware('signed')->group(function () {
    Route::get('invoices/{invoice}/pdf', [App\Http\Controllers\Api\InvoiceController::class, 'signedPdf'])
        ->name('invoice.pdf.signed');
    Route::get('reports/{report}/pdf', [App\Http\Controllers\Api\ReportController::class, 'signedPdf'])
        ->name('report.pdf.signed');
});
