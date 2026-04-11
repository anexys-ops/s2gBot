<?php

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    'allowed_origins' => array_values(array_unique(array_filter([
        env('FRONTEND_URL', 'http://localhost:5173'),
        'https://s2g.apps-dev.fr',
        'http://localhost:8081',
        'http://127.0.0.1:8081',
        'http://localhost:19006',
        'http://127.0.0.1:19006',
        'http://localhost:8082',
        'http://127.0.0.1:8082',
    ]))),
    // Expo Go / tunnel (requêtes depuis la cible « web » ou certains clients)
    'allowed_origins_patterns' => [
        '#^https?://[^/]+\.exp\.direct$#',
        '#^https?://[^/]+\.exp\.host$#',
    ],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => true,
];
