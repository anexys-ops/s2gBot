<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ReportFormDefinition;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportFormDefinitionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $query = ReportFormDefinition::query()->where('active', true)->orderBy('name');
        if ($request->filled('service_key')) {
            $query->where(function ($q) use ($request) {
                $q->where('service_key', $request->query('service_key'))
                    ->orWhereNull('service_key');
            });
        }

        return response()->json(['data' => $query->get()]);
    }
}
