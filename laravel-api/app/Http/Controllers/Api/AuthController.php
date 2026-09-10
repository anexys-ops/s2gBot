<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\PasswordResetMail;
use App\Models\Agency;
use App\Models\Client;
use App\Models\Site;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\SecurityLogger;
use App\Services\SessionPresenceService;
use App\Support\ClientPortalAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password as PasswordBroker;
use Illuminate\Validation\Rules\Password;

class AuthController extends Controller
{
    public function __construct(
        private SecurityLogger $securityLogger,
        private ActivityLogger $activityLogger,
        private SessionPresenceService $presence,
    ) {}

    public function forgotPassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => 'required|email',
        ]);

        $message = 'Si cette adresse est reconnue, un e-mail de réinitialisation vient d\'être envoyé.';
        $user = User::query()->where('email', $validated['email'])->first();

        if ($user === null) {
            $this->securityLogger->log('password_reset_requested', $validated['email'], [
                'found' => false,
            ]);

            return response()->json(['message' => $message]);
        }

        $token = PasswordBroker::broker()->createToken($user);
        $frontendUrl = rtrim((string) env('FRONTEND_URL', config('app.url')), '/');
        $resetUrl = $frontendUrl.'/login/reinitialiser?token='.urlencode($token).'&email='.urlencode($user->email);

        try {
            Mail::to($user->email)->send(new PasswordResetMail($user, $resetUrl));
        } catch (\Throwable $e) {
            $this->securityLogger->log('password_reset_failed', $user->email, [
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Envoi e-mail impossible pour le moment. Contactez l\'administrateur.',
            ], 503);
        }

        $this->securityLogger->log('password_reset_requested', $user->email, [
            'found' => true,
        ]);

        return response()->json(['message' => $message]);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => 'required|email',
            'token' => 'required|string',
            'password' => ['required', 'confirmed', Password::defaults()],
        ]);

        $status = PasswordBroker::broker()->reset(
            $validated,
            function (User $user, string $password): void {
                $user->forceFill(['password' => Hash::make($password)])->saveQuietly();
                $this->activityLogger->log($user, 'account.password.reset', $user);
            }
        );

        if ($status === PasswordBroker::PASSWORD_RESET) {
            return response()->json([
                'message' => 'Mot de passe mis à jour. Vous pouvez vous connecter.',
            ]);
        }

        return response()->json([
            'message' => __($status),
        ], 422);
    }

    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
            'device_name' => 'nullable|string|max:255',
        ]);

        if (! Auth::attempt($request->only('email', 'password'))) {
            $this->securityLogger->log('login_failed', $request->input('email'), [
                'reason' => 'invalid_credentials',
            ]);

            return response()->json(['message' => 'Identifiants invalides'], 401);
        }

        $user = Auth::user();
        $device = $request->input('device_name');
        $tokenName = is_string($device) && trim($device) !== '' ? trim($device) : 'spa';
        // Keep existing SPA tokens so another tab/device login does not disconnect active sessions.
        $accessToken = $user->createToken($tokenName);
        $token = $accessToken->plainTextToken;

        $this->activityLogger->log($user, 'auth.login', null, [
            'device' => $tokenName,
        ]);
        $this->presence->touch($user, $accessToken->accessToken, $request, '/login');

        $user->load(['client', 'site', 'agency', 'accessGroups', 'agencies']);
        $payload = $this->serializeUser($user);

        return response()->json([
            'user' => $payload,
            'token' => $token,
            'token_type' => 'Bearer',
        ]);
    }

    public function register(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => ['required', 'confirmed', Password::defaults()],
            'role' => 'required|in:client,site_contact',
            'client_id' => 'required_if:role,client,site_contact|nullable|exists:clients,id',
            'site_id' => 'required_if:role,site_contact|nullable|exists:sites,id',
        ]);

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'role' => $request->role,
            'client_id' => $request->client_id,
            'site_id' => $request->site_id,
        ]);

        if ($user->site_id) {
            $site = Site::query()->find($user->site_id);
            if ($site && $site->agency_id) {
                $user->agencies()->sync([$site->agency_id]);
            }
        }

        $token = $user->createToken('spa')->plainTextToken;

        $user->load(['client', 'site', 'agency', 'accessGroups', 'agencies']);

        return response()->json([
            'user' => $this->serializeUser($user),
            'token' => $token,
            'token_type' => 'Bearer',
        ], 201);
    }

    /**
     * Liste minimale des clients pour le formulaire d'inscription (sans authentification).
     */
    public function registerClientList(): JsonResponse
    {
        $clients = Client::query()->orderBy('name')->get(['id', 'name']);

        return response()->json($clients);
    }

    /**
     * Chantiers d'un client pour l'inscription « contact chantier » (sans authentification).
     */
    public function registerSiteList(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'client_id' => 'required|integer|exists:clients,id',
        ]);

        $sites = Site::query()
            ->where('client_id', $validated['client_id'])
            ->orderBy('name')
            ->get(['id', 'name', 'client_id']);

        return response()->json($sites);
    }

    /**
     * Agences d'un client (inscription / choix tenant).
     */
    public function registerAgencyList(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'client_id' => 'required|integer|exists:clients,id',
        ]);

        $agencies = Agency::query()
            ->where('client_id', $validated['client_id'])
            ->orderByDesc('is_headquarters')
            ->orderBy('name')
            ->get(['id', 'name', 'client_id', 'is_headquarters', 'code']);

        return response()->json($agencies);
    }

    public function logout(Request $request): JsonResponse
    {
        $token = $request->user()->currentAccessToken();
        if ($token !== null) {
            $this->presence->removeToken($token->id);
            $this->activityLogger->log($request->user(), 'auth.logout');
            $token->delete();
        }

        return response()->json(['message' => 'Déconnexion réussie']);
    }

    public function user(Request $request): JsonResponse
    {
        $u = $request->user()->load(['client', 'site', 'accessGroups', 'agencies']);

        return response()->json($this->serializeUser($u));
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeUser(User $user): array
    {
        $data = $user->toArray();
        $data['effective_permissions'] = $user->effectivePermissionKeys();

        return array_merge($data, ClientPortalAccess::authPayload($user));
    }
}
