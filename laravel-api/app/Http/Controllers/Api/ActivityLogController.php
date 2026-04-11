<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
}
