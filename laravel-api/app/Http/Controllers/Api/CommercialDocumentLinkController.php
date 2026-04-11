<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CommercialDocumentLink;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\Quote;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CommercialDocumentLinkController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'document_type' => ['required', Rule::in(['quote', 'invoice', 'order'])],
            'document_id' => 'required|integer',
        ]);

        $this->findModel($validated['document_type'], $validated['document_id']);

        $type = $validated['document_type'];
        $id = (int) $validated['document_id'];

        $links = CommercialDocumentLink::query()
            ->where(function ($q) use ($type, $id) {
                $q->where('source_type', $type)->where('source_id', $id)
                    ->orWhere('target_type', $type)->where('target_id', $id);
            })
            ->orderByDesc('id')
            ->get();

        return response()->json($links);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'source_type' => ['required', Rule::in(['quote', 'invoice', 'order'])],
            'source_id' => 'required|integer',
            'target_type' => ['required', Rule::in(['quote', 'invoice', 'order'])],
            'target_id' => 'required|integer',
            'relation' => ['required', Rule::in([
                CommercialDocumentLink::RELATION_RELATED,
                CommercialDocumentLink::RELATION_CONVERTED_TO,
                CommercialDocumentLink::RELATION_REPLACES,
            ])],
        ]);

        $this->findModel($validated['source_type'], $validated['source_id']);
        $this->findModel($validated['target_type'], $validated['target_id']);

        $link = CommercialDocumentLink::firstOrCreate(
            [
                'source_type' => $validated['source_type'],
                'source_id' => $validated['source_id'],
                'target_type' => $validated['target_type'],
                'target_id' => $validated['target_id'],
                'relation' => $validated['relation'],
            ],
            []
        );

        return response()->json($link, $link->wasRecentlyCreated ? 201 : 200);
    }

    public function destroy(Request $request, CommercialDocumentLink $commercialDocumentLink): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $commercialDocumentLink->delete();

        return response()->json(null, 204);
    }

    private function findModel(string $type, int $id): Quote|Invoice|Order
    {
        return match ($type) {
            'quote' => Quote::findOrFail($id),
            'invoice' => Invoice::findOrFail($id),
            'order' => Order::findOrFail($id),
        };
    }
}
