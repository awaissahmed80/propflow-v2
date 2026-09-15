<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use Database\Seeders\TenantDatabaseSeeder;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;

#[Signature('tenant:migrate {tenant : Tenant id, identifier, or database name} {--fresh} {--seed}')]
#[Description('Run migrations for a tenant database')]
class MigrateTenant extends Command
{
    public function handle(): int
    {
        $tenantKey = (string) $this->argument('tenant');

        $tenant = Tenant::query()
            ->where('id', $tenantKey)
            ->orWhere('identifier', $tenantKey)
            ->orWhere('database', $tenantKey)
            ->first();

        if (! $tenant) {
            $this->error("Tenant [{$tenantKey}] not found.");

            return self::FAILURE;
        }

        if (blank($tenant->database)) {
            $this->error("Tenant [{$tenant->identifier}] has no database configured.");

            return self::FAILURE;
        }

        $this->info("Migrating tenant DB: {$tenant->database} ({$tenant->identifier})");

        $this->configureTenantConnection($tenant->database);

        $params = [
            '--database' => 'tenant',
            '--path' => 'database/migrations/tenant',
            '--force' => true,
        ];

        if ($this->option('fresh')) {
            $this->call('migrate:fresh', $params);
        } else {
            $this->call('migrate', $params);
        }

        if ($this->option('seed')) {
            $tenant->makeCurrent();
            $this->call('db:seed', [
                '--class' => TenantDatabaseSeeder::class,
                '--database' => 'tenant',
                '--force' => true,
            ]);
            Tenant::forgetCurrent();
        }

        $this->info("Migration complete for {$tenant->database}");

        return self::SUCCESS;
    }

    protected function configureTenantConnection(string $database): void
    {
        Config::set('database.connections.tenant.database', $database);
        DB::purge('tenant');
        DB::reconnect('tenant');
    }
}
