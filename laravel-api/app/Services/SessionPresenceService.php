<?php

namespace App\Services;

use App\Models\User;
use App\Models\UserSessionPresence;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;

class SessionPresenceService
{
    public function touch(User $user, PersonalAccessToken $token, Request $request, ?string $currentPage = null): UserSessionPresence
    {
        $now = now();

        return UserSessionPresence::query()->updateOrCreate(
            ['token_id' => $token->id],
            [
                'user_id' => $user->id,
                'ip_address' => $request->ip(),
                'user_agent' => SecurityLogger::truncateUserAgent($request->userAgent()),
                'current_page' => $currentPage ? mb_substr($currentPage, 0, 512) : null,
                'last_seen_at' => $now,
                'created_at' => UserSessionPresence::query()
                    ->where('token_id', $token->id)
                    ->value('created_at') ?? $now,
            ]
        );
    }

    public function removeToken(int $tokenId): void
    {
        UserSessionPresence::query()->where('token_id', $tokenId)->delete();
    }

    /**
     * @return \Illuminate\Database\Eloquent\Collection<int, UserSessionPresence>
     */
    public function activeSessions(int $staleMinutes = 30)
    {
        return UserSessionPresence::query()
            ->with('user:id,name,email,role')
            ->where('last_seen_at', '>=', now()->subMinutes($staleMinutes))
            ->orderByDesc('last_seen_at')
            ->get();
    }
}
