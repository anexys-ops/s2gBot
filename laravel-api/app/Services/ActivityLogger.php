<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

class ActivityLogger
{
    public function log(?User $user, string $action, ?Model $subject = null, ?array $properties = null): ActivityLog
    {
        $req = request();

        return ActivityLog::query()->create([
            'user_id' => $user?->id,
            'action' => $action,
            'subject_type' => $subject ? $subject::class : null,
            'subject_id' => $subject?->getKey(),
            'properties' => $properties,
            'ip_address' => $req?->ip(),
            'user_agent' => $req ? SecurityLogger::truncateUserAgent($req->userAgent()) : null,
            'created_at' => now(),
        ]);
    }
}
