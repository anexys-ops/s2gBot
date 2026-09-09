<?php

namespace App\Services;

use App\Models\SecurityLog;
use Illuminate\Http\Request;

class SecurityLogger
{
    public function log(string $eventType, ?string $emailAttempted = null, ?array $properties = null): SecurityLog
    {
        $request = request();

        return SecurityLog::query()->create([
            'event_type' => $eventType,
            'email_attempted' => $emailAttempted,
            'ip_address' => $request instanceof Request ? $request->ip() : null,
            'user_agent' => $request instanceof Request ? self::truncateUserAgent($request->userAgent()) : null,
            'properties' => $properties,
            'created_at' => now(),
        ]);
    }

    public static function truncateUserAgent(?string $userAgent): ?string
    {
        if ($userAgent === null || $userAgent === '') {
            return null;
        }

        return mb_substr($userAgent, 0, 512);
    }
}
