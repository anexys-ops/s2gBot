<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Models\MobileAuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class MobileAuditLogController extends Controller
{
    /** Clés jamais conservees dans "details", meme si le client mobile les envoie par erreur. */
    private const FORBIDDEN_DETAIL_KEYS = ['password', 'mot_de_passe', 'token', 'secret'];

    /** POST /mobile/audit-logs — n'importe quel utilisateur authentifie journalise ses propres actions. */
    public function store(Request $request): JsonResponse
    {
        // TEMPORAIRE — diagnostic du bug 422 signale par l'appli mobile (retirer une fois resolu).
        Log::channel('single')->info('mobile-audit-logs.debug', [
            'content_type' => $request->header('Content-Type'),
            'raw_body' => $request->getContent(),
            'parsed_all' => $request->all(),
            'user_id' => $request->user()?->id,
        ]);

        $data = $request->validate([
            'action' => 'required|string|max:64',
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
            'accuracy' => 'nullable|numeric|min:0',
            'timestamp' => 'required|date',
            'details' => 'nullable|array',
        ]);

        $details = $data['details'] ?? null;
        if (is_array($details)) {
            foreach (self::FORBIDDEN_DETAIL_KEYS as $key) {
                unset($details[$key]);
            }
        }

        $log = MobileAuditLog::create([
            'user_id' => $request->user()->id,
            'action' => $data['action'],
            'latitude' => $data['latitude'] ?? null,
            'longitude' => $data['longitude'] ?? null,
            'accuracy' => $data['accuracy'] ?? null,
            'occurred_at' => $data['timestamp'],
            'details' => $details,
            'ip_address' => $request->ip(),
            'user_agent' => (string) $request->userAgent(),
        ]);

        return response()->json(['success' => true, 'logId' => 'log_'.$log->id]);
    }

    /** GET /mobile/audit-logs — consultation reservee aux admins labo, filtrable par utilisateur/date/action. */
    public function index(Request $request): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $limit = min(200, max(1, (int) $request->query('limit', 100)));

        $query = MobileAuditLog::query()->with('user:id,name,email')->orderByDesc('occurred_at');

        if ($userId = $request->query('user_id')) {
            $query->where('user_id', $userId);
        }
        if ($action = trim((string) $request->query('action', ''))) {
            $query->where('action', 'like', '%'.$action.'%');
        }
        if ($from = $request->query('from')) {
            $query->where('occurred_at', '>=', $from);
        }
        if ($to = $request->query('to')) {
            $query->where('occurred_at', '<=', $to);
        }

        return response()->json($query->limit($limit)->get());
    }
}
