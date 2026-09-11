<?php

namespace App\Http\Middleware;

use App\Services\SystemErrorLogger;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class LogApiHttpErrors
{
    public function __construct(private SystemErrorLogger $errorLogger) {}

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $status = $response->getStatusCode();
        if ($status >= 400 && ! ($status === 401 && $request->is('api/login'))) {
            $userId = $request->user()?->id;
            $message = null;
            $content = $response->getContent();
            if (is_string($content) && $content !== '') {
                $decoded = json_decode($content, true);
                if (is_array($decoded) && isset($decoded['message']) && is_string($decoded['message'])) {
                    $message = $decoded['message'];
                }
            }

            $this->errorLogger->logHttpError($status, $request, $message, null, $userId);
        }

        return $response;
    }
}
