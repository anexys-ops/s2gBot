<?php

namespace App\Http\Controllers\Api\Catalogue;

use App\Http\Controllers\Controller;
use App\Models\Catalogue\Package;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PackageController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = Package::query()->with(['famillePackage' => fn ($f) => $f->with('article.famille')]);
        if (! $request->boolean('with_inactif')) {
            $q->actif();
        }
        if ($request->filled('ref_famille_package_id')) {
            $q->where('ref_famille_package_id', (int) $request->query('ref_famille_package_id'));
        }
        if ($request->filled('ref_article_id')) {
            $aid = (int) $request->query('ref_article_id');
            $q->whereHas('famillePackage', fn ($b) => $b->where('ref_article_id', $aid));
        }

        return response()->json($q->ordonne()->get());
    }
}
