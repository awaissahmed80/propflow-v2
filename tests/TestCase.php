<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Artisan;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $landlordSqlite = [
            'driver' => 'sqlite',
            'database' => ':memory:',
            'prefix' => '',
            'foreign_key_constraints' => true,
        ];

        $tenantSqlite = [
            'driver' => 'sqlite',
            'database' => ':memory:',
            'prefix' => '',
            'foreign_key_constraints' => true,
        ];

        config([
            'database.default' => 'landlord',
            'database.connections.landlord' => $landlordSqlite,
            'database.connections.tenant' => $tenantSqlite,
            'permission.teams' => false,
            'multitenancy.tenant_database_connection_name' => 'tenant',
            'multitenancy.landlord_database_connection_name' => 'landlord',
            'multitenancy.switch_tenant_tasks' => [],
        ]);
    }

    protected function migrateLandlord(): void
    {
        Artisan::call('migrate', [
            '--database' => 'landlord',
            '--path' => 'database/migrations/landlord',
            '--force' => true,
        ]);
    }

    protected function migrateTenant(): void
    {
        Artisan::call('migrate', [
            '--database' => 'tenant',
            '--path' => 'database/migrations/tenant',
            '--force' => true,
        ]);
    }
}
