@php
    $linesCfg = is_array($layoutConfig['lines'] ?? null) ? $layoutConfig['lines'] : [];
    $metaCfg = is_array($layoutConfig['meta'] ?? null) ? $layoutConfig['meta'] : [];
    $totalsCfg = is_array($layoutConfig['totals'] ?? null) ? $layoutConfig['totals'] : [];
    $showLinePrices = ($linesCfg['show_prices'] ?? true) !== false;
    $showPuPtCols = $showLinePrices && (($linesCfg['show_pu_pt_columns'] ?? true) !== false);
    $showDesignation = ($linesCfg['show_designation'] ?? true) !== false;
    $showArticleCode = ($linesCfg['show_article_code'] ?? true) !== false;
    $showQuantity = ($linesCfg['show_quantity'] ?? true) !== false;
    $showUnit = ($linesCfg['show_unit'] ?? true) !== false;
    $showLineDetails = ($linesCfg['show_line_details'] ?? true) !== false;
    $showTotalHt = ($totalsCfg['show_total_ht'] ?? true) !== false;
    $showTotalTva = ($totalsCfg['show_total_tva'] ?? true) !== false;
    $showTotalTtc = ($totalsCfg['show_total_ttc'] ?? true) !== false;
    $showClientName = ($metaCfg['show_client_name'] ?? true) !== false;
    $showDossierReference = ($metaCfg['show_dossier_reference'] ?? true) !== false;
    $showLinkedQuote = ($metaCfg['show_linked_quote'] ?? true) !== false;
    $showAffaire = ($metaCfg['show_affaire'] ?? true) !== false;
@endphp
