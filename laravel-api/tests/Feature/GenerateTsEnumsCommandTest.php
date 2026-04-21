<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\File;
use Tests\TestCase;

class GenerateTsEnumsCommandTest extends TestCase
{
    public function test_it_generates_typescript_enums_file(): void
    {
        $relativePath = 'laravel-api/storage/framework/testing/enums.generated.ts';
        $absolutePath = dirname(base_path()).'/'.$relativePath;
        File::ensureDirectoryExists(dirname($absolutePath));
        File::delete($absolutePath);

        $this->artisan('generate:ts-enums', ['--path' => $relativePath])->assertExitCode(0);

        $this->assertTrue(File::exists($absolutePath));
        $content = File::get($absolutePath);
        $this->assertStringContainsString('export const SITE_STATUSES', $content);
        $this->assertStringContainsString("  'not_started',", $content);
        $this->assertStringContainsString('export type SiteStatus', $content);

        File::delete($absolutePath);
    }
}
