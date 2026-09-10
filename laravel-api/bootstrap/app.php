<?php

use App\Services\SystemErrorLogger;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        apiPrefix: 'api',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // Reverse proxy (Docker / Nginx / TLS en amont)
        $middleware->trustProxies(at: '*');

        // v1.2.0 — alias `role:` pour la garde RBAC (App\Http\Middleware\EnsureRole)
        $middleware->alias([
            'role' => \App\Http\Middleware\EnsureRole::class,
        ]);

        $middleware->appendToGroup('api', \App\Http\Middleware\LogApiHttpErrors::class);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->reportable(function (Throwable $e) {
            if (! app()->bound(SystemErrorLogger::class)) {
                return;
            }
            $request = request();
            if (! $request instanceof Request || ! $request->is('api/*')) {
                return;
            }

            $status = 500;
            if ($e instanceof HttpExceptionInterface) {
                $status = $e->getStatusCode();
            }

            if ($status < 500) {
                return;
            }

            app(SystemErrorLogger::class)->logHttpError(
                $status,
                $request,
                $e->getMessage(),
                $e,
                $request->user()?->id
            );
        });
    })->create();
