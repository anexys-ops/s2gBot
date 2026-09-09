<?php

namespace App\Services;

use App\Models\SystemErrorLog;
use Illuminate\Http\Request;
use Throwable;

class SystemErrorLogger
{
    public function logHttpError(
        int $statusCode,
        Request $request,
        ?string $message = null,
        ?Throwable $exception = null,
        ?int $userId = null,
    ): ?SystemErrorLog {
        if ($statusCode < 400) {
            return null;
        }

        return SystemErrorLog::query()->create([
            'status_code' => $statusCode,
            'method' => $request->method(),
            'url' => mb_substr($request->fullUrl(), 0, 2048),
            'message' => $message ? mb_substr($message, 0, 2000) : null,
            'exception_class' => $exception ? $exception::class : null,
            'user_id' => $userId,
            'ip_address' => $request->ip(),
            'user_agent' => SecurityLogger::truncateUserAgent($request->userAgent()),
            'created_at' => now(),
        ]);
    }
}
