<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MailLog;
use App\Models\MailTemplate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

class MailController extends Controller
{
    public function templates(Request $request): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $templates = MailTemplate::orderBy('name')->get();

        return response()->json(['data' => $templates]);
    }

    public function logs(Request $request): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $logs = MailLog::with('user:id,name')
            ->orderByDesc('sent_at')
            ->paginate(20);

        return response()->json($logs);
    }

    public function send(Request $request): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $validated = $request->validate([
            'to' => 'required|email',
            'subject' => 'required|string|max:255',
            'body' => 'required|string',
            'template_name' => 'nullable|string|max:100',
        ]);

        try {
            Mail::raw($validated['body'], function ($message) use ($validated) {
                $message->to($validated['to'])
                    ->subject($validated['subject']);
            });

            MailLog::create([
                'to' => $validated['to'],
                'subject' => $validated['subject'],
                'template_name' => $validated['template_name'] ?? null,
                'status' => 'sent',
                'user_id' => $request->user()->id,
                'sent_at' => now(),
            ]);
        } catch (\Throwable $e) {
            MailLog::create([
                'to' => $validated['to'],
                'subject' => $validated['subject'],
                'template_name' => $validated['template_name'] ?? null,
                'status' => 'failed',
                'error_message' => $e->getMessage(),
                'user_id' => $request->user()->id,
                'sent_at' => now(),
            ]);

            return response()->json(['message' => 'Échec d\'envoi : '.$e->getMessage()], 500);
        }

        return response()->json(['message' => 'E-mail envoyé avec succès']);
    }
}
