<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\AppVersion;
use Illuminate\Foundation\Application;
use Illuminate\Http\JsonResponse;

class VersionController extends Controller
{
    /**
     * Public : footer du front (pas d’auth). Ne doit pas lever d’exception.
     */
    public function show(): JsonResponse
    {
        return response()->json([
            'laravel' => Application::VERSION,
            'php' => PHP_VERSION,
            /** Toujours résolu à l’instant T (évite une valeur figée si `config:cache` a été exécuté avec une ancienne APP_VERSION). */
            'api' => AppVersion::resolve(),
            /** APP_ENV — affiché dans le footer pour valider le bon serveur (staging / production). */
            'app_env' => (string) config('app.env', 'production'),
        ]);
    }
}
