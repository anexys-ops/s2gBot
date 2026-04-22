<?php

use App\Http\Controllers\Api\AccessGroupController;
use App\Http\Controllers\Api\AccountController;
use App\Http\Controllers\Api\AccountingExportController;
use App\Http\Controllers\Api\ActivityLogController;
use App\Http\Controllers\Api\AgencyController;
use App\Http\Controllers\Api\AppBrandingController;
use App\Http\Controllers\Api\AttachmentController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BoreholeController;
use App\Http\Controllers\Api\BtpCalculationController;
use App\Http\Controllers\Api\CadrageController;
use App\Http\Controllers\Api\CalibrationController;
use App\Http\Controllers\Api\Catalogue\ArticleController;
use App\Http\Controllers\Api\Catalogue\CatalogueArbreController;
use App\Http\Controllers\Api\Catalogue\FamilleArticleController;
use App\Http\Controllers\Api\Catalogue\PackageController;
use App\Http\Controllers\Api\Catalogue\TacheController;
use App\Http\Controllers\Api\ClientAddressController;
use App\Http\Controllers\Api\ClientCommercialController;
use App\Http\Controllers\Api\ClientController;
use App\Http\Controllers\Api\CommercialDocumentLinkController;
use App\Http\Controllers\Api\CommercialOfferingController;
use App\Http\Controllers\Api\CorrectiveActionController;
use App\Http\Controllers\Api\DocumentPdfTemplateController;
use App\Http\Controllers\Api\DossierController;
use App\Http\Controllers\Api\EquipmentController;
use App\Http\Controllers\Api\ExamplePdfController;
use App\Http\Controllers\Api\ExtrafieldDefinitionController;
use App\Http\Controllers\Api\ExtrafieldValueController;
use App\Http\Controllers\Api\InvoiceController;
use App\Http\Controllers\Api\LithologyLayerController;
use App\Http\Controllers\Api\MailController;
use App\Http\Controllers\Api\MailTemplateController;
use App\Http\Controllers\Api\MissionController;
use App\Http\Controllers\Api\Mobile\MobileDossierController;
use App\Http\Controllers\Api\ModuleSettingController;
use App\Http\Controllers\Api\NonConformityController;
use App\Http\Controllers\Api\OpenApiController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\PdfController;
use App\Http\Controllers\Api\QuoteController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\ReportFormDefinitionController;
use App\Http\Controllers\Api\ReportPdfTemplateController;
use App\Http\Controllers\Api\SampleController;
use App\Http\Controllers\Api\SiteController;
use App\Http\Controllers\Api\StatsController;
use App\Http\Controllers\Api\TestResultController;
use App\Http\Controllers\Api\TestTypeController;
use App\Http\Controllers\Api\UserManagementController;
use App\Http\Controllers\Api\VersionController;
use App\Http\Controllers\Api\Workflow\WorkflowDefinitionController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login']);
Route::post('/register', [AuthController::class, 'register']);
Route::get('/register/clients', [AuthController::class, 'registerClientList']);
Route::get('/register/sites', [AuthController::class, 'registerSiteList']);
Route::get('/register/agencies', [AuthController::class, 'registerAgencyList']);
Route::get('/version', [VersionController::class, 'show']);
Route::get('/openapi.json', [OpenApiController::class, 'show']);

Route::middleware('auth:sanctum')->group(function () {
    Route::prefix('v1')->group(function () {
        Route::get('catalogue/familles', [FamilleArticleController::class, 'index']);
        Route::get('catalogue/familles/{famille}/articles', [FamilleArticleController::class, 'articles']);
        Route::get('catalogue/articles', [ArticleController::class, 'index']);
        Route::get('catalogue/packages', [PackageController::class, 'index']);
        Route::get('catalogue/articles/{article}', [ArticleController::class, 'show'])
            ->whereNumber('article');
        Route::post('catalogue/articles', [ArticleController::class, 'store']);
        Route::put('catalogue/articles/{article}', [ArticleController::class, 'update'])
            ->whereNumber('article');
        Route::delete('catalogue/articles/{article}', [ArticleController::class, 'destroy'])
            ->whereNumber('article');
        Route::get('catalogue/arbre', CatalogueArbreController::class);
        Route::get('catalogue/taches', [TacheController::class, 'index']);

        Route::get('dossiers', [DossierController::class, 'index']);
        Route::post('dossiers', [DossierController::class, 'store']);
        Route::get('workflow-definitions', [WorkflowDefinitionController::class, 'index']);
        Route::get('workflow-definitions/{workflow_definition}', [WorkflowDefinitionController::class, 'show'])
            ->whereNumber('workflow_definition');

        Route::get('dossiers/{dossier}/devis', [DossierController::class, 'devis'])
            ->whereNumber('dossier');
        Route::get('dossiers/{dossier}/bons', [DossierController::class, 'bons'])
            ->whereNumber('dossier');
        Route::post('dossiers/{dossier}/contacts', [DossierController::class, 'addContact'])
            ->whereNumber('dossier');
        Route::get('dossiers/{dossier}', [DossierController::class, 'show'])
            ->whereNumber('dossier');
        Route::put('dossiers/{dossier}', [DossierController::class, 'update'])
            ->whereNumber('dossier');
        Route::delete('dossiers/{dossier}', [DossierController::class, 'destroy'])
            ->whereNumber('dossier');
    });

    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);

    Route::put('user/profile', [AccountController::class, 'updateProfile']);
    Route::put('user/password', [AccountController::class, 'updatePassword']);
    Route::get('user/api-tokens', [AccountController::class, 'listApiTokens']);
    Route::post('user/api-tokens', [AccountController::class, 'createApiToken']);
    Route::delete('user/api-tokens/{tokenId}', [AccountController::class, 'revokeApiToken'])->whereNumber('tokenId');
    Route::get('permissions/catalog', [AccountController::class, 'permissionCatalog']);

    Route::prefix('admin')->group(function () {
        Route::get('activity-logs', [ActivityLogController::class, 'indexAll']);
        Route::apiResource('users', UserManagementController::class);
        Route::apiResource('access-groups', AccessGroupController::class);
    });

    Route::apiResource('clients', ClientController::class);
    Route::get('clients/{client}/agencies', [AgencyController::class, 'index']);
    Route::post('clients/{client}/agencies', [AgencyController::class, 'store']);
    Route::get('agencies/{agency}', [AgencyController::class, 'show']);
    Route::put('agencies/{agency}', [AgencyController::class, 'update']);
    Route::delete('agencies/{agency}', [AgencyController::class, 'destroy']);
    Route::get('clients/{client}/commercial-overview', [ClientCommercialController::class, 'overview']);
    Route::get('clients/{client}/addresses', [ClientAddressController::class, 'index']);
    Route::post('clients/{client}/addresses', [ClientAddressController::class, 'store']);
    Route::put('client-addresses/{client_address}', [ClientAddressController::class, 'update']);
    Route::delete('client-addresses/{client_address}', [ClientAddressController::class, 'destroy']);
    Route::apiResource('sites', SiteController::class);
    Route::get('sites/{site}/missions', [MissionController::class, 'index']);
    Route::post('sites/{site}/missions', [MissionController::class, 'store']);
    Route::get('missions/{mission}', [MissionController::class, 'show']);
    Route::patch('missions/{mission}', [MissionController::class, 'update']);
    Route::delete('missions/{mission}', [MissionController::class, 'destroy']);
    Route::get('missions/{mission}/boreholes', [BoreholeController::class, 'index']);
    Route::post('missions/{mission}/boreholes', [BoreholeController::class, 'store']);
    Route::get('boreholes/{borehole}', [BoreholeController::class, 'show']);
    Route::patch('boreholes/{borehole}', [BoreholeController::class, 'update']);
    Route::delete('boreholes/{borehole}', [BoreholeController::class, 'destroy']);
    Route::get('boreholes/{borehole}/lithology-layers', [LithologyLayerController::class, 'index']);
    Route::post('boreholes/{borehole}/lithology-layers', [LithologyLayerController::class, 'store']);
    Route::get('lithology-layers/{lithology_layer}', [LithologyLayerController::class, 'show']);
    Route::patch('lithology-layers/{lithology_layer}', [LithologyLayerController::class, 'update']);
    Route::delete('lithology-layers/{lithology_layer}', [LithologyLayerController::class, 'destroy']);
    Route::apiResource('test-types', TestTypeController::class);
    Route::apiResource('equipments', EquipmentController::class);
    Route::get('equipments/{equipment}/calibrations', [CalibrationController::class, 'index']);
    Route::post('equipments/{equipment}/calibrations', [CalibrationController::class, 'store']);
    Route::get('equipments/{equipment}/calibrations/{calibration}', [CalibrationController::class, 'show']);
    Route::put('equipments/{equipment}/calibrations/{calibration}', [CalibrationController::class, 'update']);
    Route::patch('equipments/{equipment}/calibrations/{calibration}', [CalibrationController::class, 'update']);
    Route::delete('equipments/{equipment}/calibrations/{calibration}', [CalibrationController::class, 'destroy']);
    // ISO 17025 — non-conformités & actions correctives (CAPA / 8D)
    Route::get('non-conformities/stats', [NonConformityController::class, 'stats']);
    Route::apiResource('non-conformities', NonConformityController::class);
    Route::post('non-conformities/{non_conformity}/corrective-actions', [CorrectiveActionController::class, 'store']);
    Route::patch('corrective-actions/{corrective_action}', [CorrectiveActionController::class, 'update']);
    Route::delete('corrective-actions/{corrective_action}', [CorrectiveActionController::class, 'destroy']);
    Route::apiResource('orders', OrderController::class);
    Route::get('orders/{order}/samples', [SampleController::class, 'index']);
    Route::apiResource('samples', SampleController::class)->except(['index']);
    Route::post('samples/{sample}/results', [TestResultController::class, 'store']);
    Route::get('orders/{order}/results', [TestResultController::class, 'byOrder']);
    Route::post('orders/{order}/reports', [ReportController::class, 'generate']);
    Route::get('orders/{order}/reports', [ReportController::class, 'index']);
    Route::get('reports/{report}/download', [ReportController::class, 'download']);
    Route::get('reports/{report}/versions', [ReportController::class, 'versions']);
    Route::get('reports/{report}/pdf-link', [ReportController::class, 'pdfLink']);
    Route::post('reports/{report}/sign', [ReportController::class, 'sign']);
    Route::post('reports/{report}/submit-review', [ReportController::class, 'submitReview']);
    Route::post('reports/{report}/approve-review', [ReportController::class, 'approveReview']);
    Route::get('branding', [AppBrandingController::class, 'show']);
    Route::post('branding/logo', [AppBrandingController::class, 'uploadLogo']);
    Route::delete('branding/logo', [AppBrandingController::class, 'destroyLogo']);

    Route::get('report-pdf-templates', [ReportPdfTemplateController::class, 'index']);
    Route::put('report-pdf-templates/{report_pdf_template}', [ReportPdfTemplateController::class, 'update']);
    Route::get('report-form-definitions', [ReportFormDefinitionController::class, 'index']);
    Route::post('invoices/from-orders', [InvoiceController::class, 'fromOrders']);
    Route::get('invoices/unpaid', [InvoiceController::class, 'unpaid']);
    Route::get('invoices/{invoice}/pdf-link', [InvoiceController::class, 'pdfLink']);
    Route::apiResource('invoices', InvoiceController::class);
    Route::apiResource('quotes', QuoteController::class);
    Route::apiResource('commercial-offerings', CommercialOfferingController::class);
    Route::get('pdf/templates', [PdfController::class, 'templates']);
    Route::post('pdf/generate', [PdfController::class, 'generate']);
    Route::get('pdf/examples/{slug}', [ExamplePdfController::class, 'download']);
    Route::get('mail/templates', [MailController::class, 'templates']);
    Route::apiResource('mail-templates', MailTemplateController::class)->only(['index', 'store', 'update', 'destroy']);
    Route::get('mail/logs', [MailController::class, 'logs']);
    Route::post('mail/send', [MailController::class, 'send']);

    // LIMS BTP — Cadrage (Semaine 0) et exemples de calculs
    Route::get('cadrage', [CadrageController::class, 'show']);
    Route::put('cadrage', [CadrageController::class, 'update']);
    Route::get('btp-calculations/exemples', [BtpCalculationController::class, 'exemples']);
    Route::post('btp-calculations/calculer', [BtpCalculationController::class, 'calculer']);
    Route::post('btp-calculations/granulometry', [BtpCalculationController::class, 'granulometry']);
    Route::get('activity-logs', [ActivityLogController::class, 'index']);
    Route::get('stats/essais', [StatsController::class, 'essais']);
    Route::get('stats/dashboard', [StatsController::class, 'dashboard']);
    Route::get('accounting/exports', [AccountingExportController::class, 'export']);

    Route::get('attachments', [AttachmentController::class, 'index']);
    Route::post('attachments', [AttachmentController::class, 'store']);
    Route::get('attachments/{attachment}/download', [AttachmentController::class, 'download']);
    Route::delete('attachments/{attachment}', [AttachmentController::class, 'destroy']);

    Route::get('commercial-links', [CommercialDocumentLinkController::class, 'index']);
    Route::post('commercial-links', [CommercialDocumentLinkController::class, 'store']);
    Route::delete('commercial-links/{commercial_document_link}', [CommercialDocumentLinkController::class, 'destroy']);

    Route::get('document-pdf-templates', [DocumentPdfTemplateController::class, 'index']);
    Route::put('document-pdf-templates/{document_pdf_template}', [DocumentPdfTemplateController::class, 'update']);

    Route::get('extrafield-definitions', [ExtrafieldDefinitionController::class, 'index']);
    Route::post('extrafield-definitions', [ExtrafieldDefinitionController::class, 'store']);
    Route::put('extrafield-definitions/{extrafield_definition}', [ExtrafieldDefinitionController::class, 'update']);
    Route::delete('extrafield-definitions/{extrafield_definition}', [ExtrafieldDefinitionController::class, 'destroy']);
    Route::get('extrafield-values', [ExtrafieldValueController::class, 'index']);
    Route::put('extrafield-values', [ExtrafieldValueController::class, 'sync']);

    Route::get('module-settings/{module_key}', [ModuleSettingController::class, 'show']);
    Route::put('module-settings/{module_key}', [ModuleSettingController::class, 'update']);

    // App mobile laboratoire / terrain — dossiers (mesures + photos)
    Route::prefix('mobile/dossiers')->group(function () {
        Route::get('{kind}/{id}/measure-forms', [MobileDossierController::class, 'measureForms'])
            ->where('kind', 'order|site')
            ->whereNumber('id');
        Route::post('{kind}/{id}/measure-submissions', [MobileDossierController::class, 'storeMeasureSubmission'])
            ->where('kind', 'order|site')
            ->whereNumber('id');
        Route::get('{kind}/{id}/photos', [MobileDossierController::class, 'photos'])
            ->where('kind', 'order|site')
            ->whereNumber('id');
        Route::post('{kind}/{id}/photos', [MobileDossierController::class, 'storePhotoMeta'])
            ->where('kind', 'order|site')
            ->whereNumber('id');
    });
});

Route::middleware('signed')->group(function () {
    Route::get('invoices/{invoice}/pdf', [InvoiceController::class, 'signedPdf'])
        ->name('invoice.pdf.signed');
    Route::get('reports/{report}/pdf', [ReportController::class, 'signedPdf'])
        ->name('report.pdf.signed');
});
