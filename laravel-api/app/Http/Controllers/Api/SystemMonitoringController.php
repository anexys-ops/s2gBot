<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\SecurityLog;
use App\Models\SystemErrorLog;
use App\Services\SessionPresenceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SystemMonitoringController extends Controller
{
    public function __construct(private SessionPresenceService $presence) {}

    public function activityLogs(Request $request): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $limit = min(200, max(1, (int) $request->query('limit', 100)));
        $category = trim((string) $request->query('category', ''));
        $search = trim((string) $request->query('search', ''));
        $entity = trim((string) $request->query('entity', ''));

        $query = ActivityLog::query()->with('user:id,name,email')->orderByDesc('created_at');

        if ($category !== '') {
            $query->where('action', 'like', match ($category) {
                'created' => '%.created',
                'updated' => '%.updated',
                'deleted' => '%.deleted',
                'print' => '%.generated',
                default => '%'.$category.'%',
            });
        }

        if ($entity !== '') {
            $query->where('action', 'like', match ($entity) {
                'quote', 'devis' => 'quote.%',
                'invoice', 'facture' => 'invoice.%',
                'client' => 'client.%',
                default => $entity.'%',
            });
        }

        if ($search !== '') {
            $like = '%'.$search.'%';
            $query->where(function ($q) use ($like, $search) {
                $q->where('description', 'like', $like)
                    ->orWhere('action', 'like', $like)
                    ->orWhere('properties', 'like', $like);
                if (ctype_digit($search)) {
                    $q->orWhere('subject_id', (int) $search);
                }
            });
        }

        return response()->json($query->limit($limit)->get());
    }

    public function errorLogs(Request $request): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $limit = min(200, max(1, (int) $request->query('limit', 100)));
        $statusFilter = $request->query('status_group');

        $query = SystemErrorLog::query()->with('user:id,name,email')->orderByDesc('created_at');

        if ($statusFilter === '4xx') {
            $query->whereBetween('status_code', [400, 499]);
        } elseif ($statusFilter === '5xx') {
            $query->whereBetween('status_code', [500, 599]);
        } elseif ($statusFilter === '404') {
            $query->where('status_code', 404);
        }

        return response()->json($query->limit($limit)->get());
    }

    public function securityLogs(Request $request): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $limit = min(200, max(1, (int) $request->query('limit', 100)));

        $logs = SecurityLog::query()
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get();

        return response()->json($logs);
    }

    public function activeSessions(Request $request): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $staleMinutes = min(120, max(5, (int) $request->query('stale_minutes', 30)));

        return response()->json($this->presence->activeSessions($staleMinutes));
    }

    public function updatePresence(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'page' => 'nullable|string|max:512',
        ]);

        $token = $request->user()->currentAccessToken();
        if ($token === null) {
            return response()->json(['message' => 'Session invalide'], 401);
        }

        $presence = $this->presence->touch(
            $request->user(),
            $token,
            $request,
            $validated['page'] ?? null
        );

        return response()->json([
            'last_seen_at' => $presence->last_seen_at?->toIso8601String(),
        ]);
    }
}
