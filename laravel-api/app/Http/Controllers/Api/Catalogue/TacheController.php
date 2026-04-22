<?php

namespace App\Http\Controllers\Api\Catalogue;

use App\Http\Controllers\Controller;
use App\Models\Catalogue\Tache;
use Illuminate\Http\JsonResponse;

class TacheController extends Controller
{
    public function index(): JsonResponse
    {
        $rows = Tache::query()->ordonne()->get();

        return response()->json($rows);
    }
}
