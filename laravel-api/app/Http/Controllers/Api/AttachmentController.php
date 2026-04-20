<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attachment;
use App\Models\Calibration;
use App\Models\Client;
use App\Models\Equipment;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\Quote;
use App\Models\Site;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AttachmentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'attachable_type' => ['required', Rule::in(['client', 'quote', 'invoice', 'order', 'site', 'equipment', 'calibration'])],
            'attachable_id' => 'required|integer',
        ]);

        $class = $this->resolveClass($validated['attachable_type']);
        $model = $class::findOrFail($validated['attachable_id']);
        if (! $this->userCanAccessAttachmentContext($request->user(), $model)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        return response()->json($model->attachments()->orderByDesc('id')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'file' => 'required|file|max:15360',
            'attachable_type' => ['required', Rule::in(['client', 'quote', 'invoice', 'order', 'site', 'equipment', 'calibration'])],
            'attachable_id' => 'required|integer',
        ]);

        $class = $this->resolveClass($validated['attachable_type']);
        $model = $class::findOrFail($validated['attachable_id']);
        if (! $this->userCanAccessAttachmentContext($request->user(), $model)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $file = $validated['file'];
        $path = $file->store('attachments', 'local');

        $attachment = $model->attachments()->create([
            'path' => $path,
            'original_filename' => $file->getClientOriginalName(),
            'mime_type' => $file->getClientMimeType(),
            'size_bytes' => $file->getSize(),
            'uploaded_by' => $request->user()->id,
        ]);

        return response()->json($attachment, 201);
    }

    public function download(Request $request, Attachment $attachment): StreamedResponse|JsonResponse
    {
        $model = $attachment->attachable;
        if (! $model) {
            return response()->json(['message' => 'Introuvable'], 404);
        }
        if (! $this->userCanAccessAttachmentContext($request->user(), $model)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        if (! Storage::disk('local')->exists($attachment->path)) {
            return response()->json(['message' => 'Fichier absent'], 404);
        }

        return Storage::disk('local')->download($attachment->path, $attachment->original_filename);
    }

    public function destroy(Request $request, Attachment $attachment): JsonResponse
    {
        if (! $request->user()->isLabAdmin()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $model = $attachment->attachable;
        if ($model && ! $this->userCanAccessAttachmentContext($request->user(), $model)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        if (Storage::disk('local')->exists($attachment->path)) {
            Storage::disk('local')->delete($attachment->path);
        }
        $attachment->delete();

        return response()->json(null, 204);
    }

    private function resolveClass(string $type): string
    {
        return match ($type) {
            'client' => Client::class,
            'quote' => Quote::class,
            'invoice' => Invoice::class,
            'order' => Order::class,
            'site' => Site::class,
            'equipment' => Equipment::class,
            'calibration' => Calibration::class,
            default => Client::class,
        };
    }

    private function userCanAccessAttachmentContext($user, object $model): bool
    {
        if ($user->isLab()) {
            return true;
        }
        if ($model instanceof Client && $user->isClient() && (int) $model->id === (int) $user->client_id) {
            return true;
        }
        if (($model instanceof Quote || $model instanceof Invoice || $model instanceof Order)
            && ($user->isClient() || $user->isSiteContact())
            && isset($model->client_id)
            && (int) $model->client_id === (int) $user->client_id) {
            return true;
        }
        if ($model instanceof Site
            && ($user->isClient() || $user->isSiteContact())
            && (int) $model->client_id === (int) $user->client_id) {
            return true;
        }

        return false;
    }
}
