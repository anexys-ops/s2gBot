<?php

namespace App\Http\Controllers\Api\Catalogue;

use App\Http\Controllers\Controller;
use App\Models\QualificationTag;
use Illuminate\Http\JsonResponse;

class QualificationTagController extends Controller
{
    public function index(): JsonResponse
    {
        $tags = QualificationTag::query()
            ->orderBy('groupe')
            ->orderBy('code')
            ->get()
            ->map(fn (QualificationTag $tag) => [
                'id' => $tag->id,
                'code' => $tag->code,
                'label' => $tag->label,
                'display_label' => $tag->displayLabel(),
                'groupe' => $tag->groupe,
            ]);

        return response()->json($tags);
    }
}
