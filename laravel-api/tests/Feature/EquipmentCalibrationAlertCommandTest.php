<?php

namespace Tests\Feature;

use App\Models\Calibration;
use App\Models\Client;
use App\Models\Equipment;
use App\Models\MailLog;
use App\Models\MailTemplate;
use App\Models\ModuleSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class EquipmentCalibrationAlertCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_command_logs_sent_when_due_calibration(): void
    {
        Mail::fake();

        MailTemplate::updateOrCreate(
            ['name' => 'equipment_calibration_due'],
            [
                'subject' => 'Alerte {{within_days}}',
                'body' => '{{equipment_lines}}',
                'description' => 'test',
            ]
        );

        $client = Client::create(['name' => 'CalCo']);
        $agencyId = (int) \App\Models\Agency::query()->where('client_id', $client->id)->where('is_headquarters', true)->value('id');

        $equipment = Equipment::create([
            'name' => 'Presse',
            'code' => 'EQ-CAL-'.uniqid(),
            'agency_id' => $agencyId,
            'status' => Equipment::STATUS_ACTIVE,
        ]);

        Calibration::create([
            'equipment_id' => $equipment->id,
            'calibration_date' => now()->subMonths(3)->toDateString(),
            'next_due_date' => now()->addDays(10)->toDateString(),
            'result' => Calibration::RESULT_OK,
        ]);

        User::factory()->labAdmin()->create(['email' => 'lab-admin-cal@example.test']);

        $this->artisan('equipments:calibration-alerts', ['--within' => 30])->assertSuccessful();

        $this->assertSame(
            1,
            MailLog::query()->where('template_name', 'equipment_calibration_due')->where('status', 'sent')->count()
        );
    }

    public function test_command_skips_when_disabled_in_settings(): void
    {
        ModuleSetting::query()->updateOrCreate(
            ['module_key' => 'equipment_calibration_alerts'],
            ['settings' => ['enabled' => false, 'within_days' => 30]]
        );

        $this->artisan('equipments:calibration-alerts')->assertSuccessful();

        $this->assertSame(0, MailLog::query()->where('template_name', 'equipment_calibration_due')->count());
    }
}
