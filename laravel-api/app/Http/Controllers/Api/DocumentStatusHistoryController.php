<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DocumentStatusHistory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DocumentStatusHistoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $request->validate([
            'document_type' => 'required|string|max:255',
            'document_id' => 'required|integer|min:1',
        ]);

        $rows = DocumentStatusHistory::query()
            ->where('document_type', $request->query('document_type'))
            ->where('document_id', (int) $request->query('document_id'))
            ->orderByDesc('id')
            ->with('user:id,name,email')
            ->limit(200)
            ->get();

        return response()->json($rows);
    }
}
