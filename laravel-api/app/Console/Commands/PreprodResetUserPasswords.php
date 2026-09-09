<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Support\PermissionCatalog;
use App\Support\UserPresentation;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class PreprodResetUserPasswords extends Command
{
    protected $signature = 'users:preprod-reset-passwords
                            {--password=Password1, : Mot de passe appliqué à tous les comptes}
                            {--export= : Chemin du fichier Markdown à générer}
                            {--dry-run : Simuler sans modifier les mots de passe}';

    protected $description = 'Réinitialise les mots de passe utilisateurs (préprod) et exporte un inventaire login / groupes / droits / agences.';

    public function handle(): int
    {
        $password = (string) $this->option('password');
        $exportPath = $this->option('export');
        $dryRun = (bool) $this->option('dry-run');

        if ($password === '') {
            $this->error('Le mot de passe ne peut pas être vide.');

            return self::FAILURE;
        }

        $users = User::query()
            ->with(['accessGroups', 'agency', 'agencies', 'client:id,name', 'site:id,name'])
            ->orderBy('role')
            ->orderBy('name')
            ->get();

        if ($users->isEmpty()) {
            $this->warn('Aucun utilisateur en base.');

            return self::SUCCESS;
        }

        $this->info(sprintf('%d utilisateur(s) trouvé(s).', $users->count()));

        if (! $dryRun) {
            DB::transaction(function () use ($users, $password) {
                foreach ($users as $user) {
                    $user->forceFill(['password' => Hash::make($password)])->saveQuietly();
                }
                DB::table('personal_access_tokens')->delete();
            });
            $this->info('Mots de passe réinitialisés et jetons API révoqués.');
        } else {
            $this->comment('Mode dry-run : aucune modification en base.');
        }

        if ($exportPath) {
            $markdown = $this->buildMarkdown($users, $password, $dryRun);
            $dir = dirname($exportPath);
            if ($dir !== '' && $dir !== '.' && ! is_dir($dir)) {
                mkdir($dir, 0755, true);
            }
            file_put_contents($exportPath, $markdown);
            $this->info("Inventaire exporté : {$exportPath}");
        }

        return self::SUCCESS;
    }

    /**
     * @param  \Illuminate\Support\Collection<int, User>  $users
     */
    private function buildMarkdown($users, string $password, bool $dryRun): string
    {
        $lines = [];
        $lines[] = '# Comptes utilisateurs — préproduction Lab BTP';
        $lines[] = '';
        $lines[] = 'Document généré le **'.now()->timezone('Africa/Casablanca')->format('d/m/Y H:i').'** (Maroc).';
        $lines[] = '';
        if ($dryRun) {
            $lines[] = '> Mode simulation (`--dry-run`) : les mots de passe n\'ont **pas** été modifiés en base.';
            $lines[] = '';
        } else {
            $lines[] = '> Les mots de passe ont été réinitialisés. Les sessions / jetons API existants ont été révoqués.';
            $lines[] = '';
        }
        $lines[] = '**Mot de passe initial (tous les comptes)** : `'.$password.'`';
        $lines[] = '';
        $lines[] = '**URL** : https://s2g.apps-dev.fr/login';
        $lines[] = '';
        $lines[] = '| Login | E-mail | Nom | Rôle | Poste | Groupes | Droits effectifs | Agence principale | Agences liées | Client | Chantier |';
        $lines[] = '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |';

        foreach ($users as $user) {
            $groups = $user->accessGroups->pluck('name')->filter()->values();
            $groupText = $groups->isNotEmpty() ? $groups->implode(', ') : '—';

            $perms = $this->formatPermissions($user);
            $agencyMain = $user->agency
                ? trim($user->agency->code.' — '.$user->agency->name)
                : ($user->isSiege() ? 'Siège (MHD)' : '—');

            $agenciesLinked = $user->agencies
                ->map(fn ($a) => trim($a->code.' — '.$a->name))
                ->filter()
                ->values();
            $agenciesText = $agenciesLinked->isNotEmpty() ? $agenciesLinked->implode(' · ') : '—';

            $lines[] = sprintf(
                '| %s | %s | %s | %s | %s | %s | %s | %s | %s | %s | %s |',
                $this->escapeMdCell((string) $user->email),
                $this->escapeMdCell((string) ($user->email ?? '—')),
                $this->escapeMdCell((string) $user->name),
                $this->escapeMdCell(UserPresentation::roleLabel($user->role)),
                $this->escapeMdCell($user->posteLabel()),
                $this->escapeMdCell($groupText),
                $this->escapeMdCell($perms),
                $this->escapeMdCell($agencyMain),
                $this->escapeMdCell($agenciesText),
                $this->escapeMdCell($user->client?->name ?? '—'),
                $this->escapeMdCell($user->site?->name ?? '—'),
            );
        }

        $lines[] = '';
        $lines[] = '## Légende des rôles';
        $lines[] = '';
        foreach (UserPresentation::roleLabels() as $key => $label) {
            $lines[] = '- `'.$key.'` : '.$label;
        }
        $lines[] = '';
        $lines[] = '## Catalogue des droits (groupes d\'accès)';
        $lines[] = '';
        foreach (PermissionCatalog::labels() as $key => $label) {
            $lines[] = '- `'.$key.'` : '.$label;
        }
        $lines[] = '';

        return implode("\n", $lines)."\n";
    }

    private function formatPermissions(User $user): string
    {
        if ($user->isLabAdmin()) {
            return 'Tous (admin laboratoire)';
        }

        $keys = $user->effectivePermissionKeys();
        if ($keys === []) {
            return '—';
        }

        $labels = PermissionCatalog::labels();
        $parts = [];
        foreach ($keys as $key) {
            $parts[] = $labels[$key] ?? $key;
        }

        return implode(' · ', $parts);
    }

    private function escapeMdCell(string $value): string
    {
        return str_replace('|', '\\|', str_replace("\n", ' ', $value));
    }
}
