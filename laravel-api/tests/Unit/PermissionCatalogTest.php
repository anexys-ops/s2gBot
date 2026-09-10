<?php

namespace Tests\Unit;

use App\Support\PermissionCatalog;
use PHPUnit\Framework\TestCase;

class PermissionCatalogTest extends TestCase
{
    public function test_commercial_group_expands_to_commercial_module_only(): void
    {
        $expanded = PermissionCatalog::expandEffective([
            PermissionCatalog::COMMERCIAL_READ,
            PermissionCatalog::COMMERCIAL_WRITE,
            PermissionCatalog::ORDERS_READ,
            PermissionCatalog::REPORTS_READ,
        ]);

        $this->assertContains(PermissionCatalog::MODULE_COMMERCIAL, $expanded);
        $this->assertContains(PermissionCatalog::MODULE_DOSSIERS, $expanded);
        $this->assertContains(PermissionCatalog::MODULE_RAPPORTS, $expanded);
        $this->assertNotContains(PermissionCatalog::MODULE_TERRAIN, $expanded);
        $this->assertNotContains(PermissionCatalog::MODULE_LABORATOIRE, $expanded);
    }

    public function test_technician_group_expands_to_technical_modules(): void
    {
        $expanded = PermissionCatalog::expandEffective([
            PermissionCatalog::ORDERS_READ,
            PermissionCatalog::ORDERS_WRITE,
            PermissionCatalog::REPORTS_READ,
            PermissionCatalog::BACK_OFFICE_READ,
        ]);

        $this->assertContains(PermissionCatalog::MODULE_TERRAIN, $expanded);
        $this->assertContains(PermissionCatalog::MODULE_LABORATOIRE, $expanded);
        $this->assertContains(PermissionCatalog::MODULE_CATALOGUE, $expanded);
        $this->assertNotContains(PermissionCatalog::MODULE_COMMERCIAL, $expanded);
    }
}
