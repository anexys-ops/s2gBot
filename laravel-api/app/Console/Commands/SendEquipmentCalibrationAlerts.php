<?php

namespace App\Console\Commands;

use App\Models\Equipment;
use App\Models\MailLog;
use App\Models\MailTemplate;
use App\Models\ModuleSetting;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

class SendEquipmentCalibrationAlerts extends Command
{
    protected $signature = 'equipments:calibration-alerts {--dry-run : Affiche les équipements sans envoyer} {--within= : Fenêtre en jours (prioritaire sur module_settings)}';

    protected $description = 'Alerte les administrateurs lab : étalonnages dont la prochaine échéance est dépassée ou dans la fenêtre configurée';

    public function handle(): int
    {
        $settings = ModuleSetting::query()->where('module_key', 'equipment_calibration_alerts')->value('settings') ?? [];
        $enabled = (bool) ($settings['enabled'] ?? true);
        if (! $enabled) {
            $this->info('Alertes équipements désactivées (module_settings.equipment_calibration_alerts.enabled).');

            return self::SUCCESS;
        }

        $optWithin = $this->option('within');
        $withinDays = $optWithin !== null && $optWithin !== ''
            ? max(1, min(365, (int) $optWithin))
            : max(1, min(365, (int) ($settings['within_days'] ?? 30)));

        $until = now()->addDays($withinDays)->toDateString();

        $equipmentIds = DB::table('calibrations as c1')
            ->select('c1.equipment_id')
            ->whereNotNull('c1.next_due_date')
            ->whereDate('c1.next_due_date', '<=', $until)
            ->whereRaw(
                'c1.calibration_date = (select max(c2.calibration_date) from calibrations c2 where c2.equipment_id = c1.equipment_id)'
            )
            ->pluck('equipment_id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();

        if ($equipmentIds === []) {
            $this->info('Aucun équipement actif avec échéance dans la fenêtre.');

            return self::SUCCESS;
        }

        $equipments = Equipment::query()
            ->where('status', Equipment::STATUS_ACTIVE)
            ->whereIn('id', $equipmentIds)
            ->with(['calibrations' => fn ($q) => $q->orderByDesc('calibration_date')->limit(1)])
            ->orderBy('code')
            ->get();

        if ($equipments->isEmpty()) {
            $this->info('Aucun équipement actif concerné.');

            return self::SUCCESS;
        }

        $lines = [];
        foreach ($equipments as $eq) {
            $cal = $eq->calibrations->first();
            $due = $cal?->next_due_date?->format('Y-m-d') ?? '—';
            $lines[] = "- {$eq->code} — {$eq->name} : prochain étalonnage {$due}";
        }
        $bodyLines = implode("\n", $lines);

        $template = MailTemplate::query()->where('name', 'equipment_calibration_due')->first();
        $subject = $template?->subject ?? 'Étalonnages à planifier ({{within_days}} j.)';
        $body = $template?->body ?? "Bonjour,\n\nLes équipements suivants ont une échéance d'étalonnage à prévoir (fenêtre {{within_days}} j.) :\n\n{{equipment_lines}}\n\nCordialement,\nL'équipe Lab BTP";

        foreach (['{{within_days}}' => (string) $withinDays, '{{equipment_lines}}' => $bodyLines] as $k => $v) {
            $subject = str_replace($k, $v, $subject);
            $body = str_replace($k, $v, $body);
        }

        $recipients = User::query()
            ->where('role', User::ROLE_LAB_ADMIN)
            ->whereNotNull('email')
            ->pluck('email')
            ->map(fn ($e) => trim((string) $e))
            ->filter(fn ($e) => $e !== '')
            ->unique()
            ->values()
            ->all();

        if ($this->option('dry-run')) {
            $this->line($subject);
            $this->line($body);

            return self::SUCCESS;
        }

        if ($recipients === []) {
            MailLog::create([
                'to' => '',
                'subject' => $subject,
                'template_name' => 'equipment_calibration_due',
                'status' => 'failed',
                'error_message' => 'Aucun administrateur lab avec e-mail',
                'user_id' => null,
                'sent_at' => now(),
            ]);
            $this->warn('Aucun administrateur lab avec e-mail : notification non envoyée.');

            return self::FAILURE;
        }

        try {
            Mail::raw($body, function ($message) use ($recipients, $subject) {
                $message->to($recipients)->subject($subject);
            });
            MailLog::create([
                'to' => implode(',', $recipients),
                'subject' => $subject,
                'template_name' => 'equipment_calibration_due',
                'status' => 'sent',
                'user_id' => null,
                'sent_at' => now(),
            ]);
        } catch (\Throwable $e) {
            MailLog::create([
                'to' => implode(',', $recipients),
                'subject' => $subject,
                'template_name' => 'equipment_calibration_due',
                'status' => 'failed',
                'error_message' => $e->getMessage(),
                'user_id' => null,
                'sent_at' => now(),
            ]);
            $this->warn('Échec envoi : '.$e->getMessage());

            return self::FAILURE;
        }

        $this->info('Notification envoyée à '.count($recipients).' destinataire(s).');

        return self::SUCCESS;
    }
}
