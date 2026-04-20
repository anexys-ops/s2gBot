<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ActivityLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $query = ActivityLog::query()->with('user')->orderByDesc('created_at');

        if ($type = trim((string) $request->query('subject_type', ''))) {
            $query->where('subject_type', $type);
        }
        if ($id = $request->query('subject_id')) {
            $query->where('subject_id', (int) $id);
        }

        $logs = $query->limit(min(200, (int) $request->query('limit', 80)))->get();

        return response()->json($logs);
    }

    /**
     * Audit trail pour administrateurs : logs actifs, ou fusion avec l’archive
     * (`?include=archive`) via UNION ALL, pagination curseur (created_at, id).
     */
    public function indexAll(Request $request): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $includeArchive = $request->query('include') === 'archive';
        $perPage = min(100, max(1, (int) $request->query('per_page', 40)));

        if (! $includeArchive) {
            $query = ActivityLog::query()->with('user')->orderByDesc('created_at');
            if ($type = trim((string) $request->query('subject_type', ''))) {
                $query->where('subject_type', $type);
            }
            if ($request->filled('subject_id')) {
                $query->where('subject_id', (int) $request->query('subject_id'));
            }

            $page = max(1, (int) $request->query('page', 1));
            $paginator = $query->paginate($perPage, ['*'], 'page', $page);

            return response()->json($paginator);
        }

        $type = trim((string) $request->query('subject_type', ''));
        $subjectId = $request->query('subject_id');

        $live = DB::table('activity_logs')->select([
            'id',
            'user_id',
            'action',
            'subject_type',
            'subject_id',
            'properties',
            'ip_address',
            'created_at',
        ]);
        $archive = DB::table('activity_logs_archive')->select([
            DB::raw('original_id as id'),
            'user_id',
            'action',
            'subject_type',
            'subject_id',
            'properties',
            'ip_address',
            'created_at',
        ]);

        if ($type !== '') {
            $live->where('subject_type', $type);
            $archive->where('subject_type', $type);
        }
        if ($subjectId !== null && $subjectId !== '') {
            $sid = (int) $subjectId;
            $live->where('subject_id', $sid);
            $archive->where('subject_id', $sid);
        }

        $union = $live->unionAll($archive);
        $merged = DB::query()->fromSub($union, 'merged_logs')
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        if ($request->filled('cursor_created_at') && $request->filled('cursor_id')) {
            $cAt = (string) $request->query('cursor_created_at');
            $cId = (int) $request->query('cursor_id');
            $merged->where(function ($w) use ($cAt, $cId) {
                $w->where('created_at', '<', $cAt)
                    ->orWhere(function ($w2) use ($cAt, $cId) {
                        $w2->where('created_at', '=', $cAt)->where('id', '<', $cId);
                    });
            });
        }

        $rows = $merged->limit($perPage + 1)->get();
        $hasMore = $rows->count() > $perPage;
        $slice = $hasMore ? $rows->slice(0, $perPage) : $rows;

        $userIds = $slice->pluck('user_id')->filter()->unique()->all();
        $users = User::query()->whereIn('id', $userIds)->get()->keyBy('id');

        $data = $slice->map(function ($row) use ($users) {
            $props = $row->properties;
            if (is_string($props)) {
                $decoded = json_decode($props, true);
                $props = is_array($decoded) ? $decoded : null;
            }

            return [
                'id' => (int) $row->id,
                'user_id' => $row->user_id ? (int) $row->user_id : null,
                'user' => $row->user_id && isset($users[$row->user_id]) ? [
                    'id' => $users[$row->user_id]->id,
                    'name' => $users[$row->user_id]->name,
                ] : null,
                'action' => $row->action,
                'subject_type' => $row->subject_type,
                'subject_id' => $row->subject_id !== null ? (int) $row->subject_id : null,
                'properties' => $props,
                'ip_address' => $row->ip_address,
                'created_at' => $row->created_at,
            ];
        })->values();

        $next = null;
        if ($hasMore && $data->isNotEmpty()) {
            $last = $slice->last();
            $next = [
                'cursor_created_at' => (string) $last->created_at,
                'cursor_id' => (int) $last->id,
            ];
        }

        return response()->json([
            'data' => $data->all(),
            'meta' => [
                'include_archive' => true,
                'per_page' => $perPage,
                'next_cursor' => $next,
            ],
        ]);
    }
}
