<?php

return [
    /*
    | Durée de conservation des journaux (activité, erreurs, sécurité) en jours.
    | Au-delà, les lignes sont supprimées définitivement du serveur.
    */
    'retention_days' => max(1, (int) env('MONITORING_RETENTION_DAYS', 7)),

    /*
    | Fréquence de purge planifiée (voir routes/console.php).
    | Valeur informative ; le cron tourne tous les 3 jours par défaut.
    */
    'purge_interval_days' => max(1, (int) env('MONITORING_PURGE_INTERVAL_DAYS', 3)),
];
