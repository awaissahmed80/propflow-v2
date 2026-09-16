<?php

namespace App\Console\Commands;

use App\Enums\TenantMembershipStatus;
use App\Enums\UserStatus;
use App\Enums\UserType;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Domain;
use Database\Seeders\TenantDatabaseSeeder;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Throwable;

#[Signature('make:tenant
        {--name= : Tenant name}
        {--database= : Database name (letters, numbers, underscores)}
        {--identifier= : Unique identifier (slug)}
        {--admin_email=admin@example.com : Admin email}
        {--password= : Admin password (preferred)}
        {--admin_password= : Admin password (alias of --password)}')]
#[Description('Create a tenant: landlord records, MySQL database, migrations, permissions, and admin role')]
class MakeTenant extends Command
{
    public function handle(): int
    {
        $name = (string) $this->option('name');
        $dbName = (string) $this->option('database');
        $identifier = (string) $this->option('identifier');
        $email = (string) $this->option('admin_email');
        $password = $this->resolveAdminPassword();

        if ($name === '' || $dbName === '' || $identifier === '') {
            $this->error('Missing required options: --name, --database, --identifier');

            return self::FAILURE;
        }

        if ($password === '') {
            $this->error('Missing required option: --password (or --admin_password)');

            return self::FAILURE;
        }

        if (! preg_match('/^[A-Za-z][A-Za-z0-9_]*$/', $dbName)) {
            $this->error('Invalid --database. Use letters, numbers, and underscores; must start with a letter.');

            return self::FAILURE;
        }

        if (! preg_match('/^[A-Za-z0-9][A-Za-z0-9_-]*$/', $identifier)) {
            $this->error('Invalid --identifier. Use letters, numbers, hyphens, and underscores.');

            return self::FAILURE;
        }

        if (Tenant::query()->where('identifier', $identifier)->exists()) {
            $this->error("A tenant with identifier [{$identifier}] already exists.");

            return self::FAILURE;
        }

        if (Tenant::query()->where('database', $dbName)->exists()) {
            $this->error("A tenant with database [{$dbName}] already exists.");

            return self::FAILURE;
        }

        $this->info("Creating tenant: {$name} ({$identifier})");

        try {
            $tenant = Tenant::query()->create([
                'name' => $name,
                'database' => $dbName,
                'identifier' => $identifier,
            ]);

            $user = User::query()->firstOrNew(['email_address' => $email]);

            if ($user->exists && $user->type !== UserType::Tenant) {
                $this->error("User [{$email}] already exists as a platform account.");

                return self::FAILURE;
            }

            $user->fill([
                'display_name' => $user->display_name ?: $name.' Admin',
                'first_name' => $user->first_name ?: $name,
                'last_name' => $user->last_name ?: 'Admin',
                'password' => $password,
                'type' => UserType::Tenant,
                'status' => UserStatus::Active,
            ]);
            $user->save();

            if (! $user->wasRecentlyCreated) {
                $this->warn("User [{$email}] already existed — password was updated to the value you passed.");
            }

            $tenant->tenantUsers()->firstOrCreate(
                ['user_id' => $user->id],
                [
                    'title' => 'Administrator',
                    'status' => TenantMembershipStatus::Active,
                    'is_owner' => true,
                ]
            );

            $this->info('Landlord tenant + membership created');

            DB::connection('landlord')->statement(
                "CREATE DATABASE IF NOT EXISTS `{$dbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            );
            $this->info("Tenant database created: {$dbName}");

            $this->configureTenantConnection($dbName);

            $this->info('Running tenant migrations...');

            $exitCode = Artisan::call('migrate', [
                '--database' => 'tenant',
                '--path' => 'database/migrations/tenant',
                '--force' => true,
            ]);

            $this->output->write(Artisan::output());

            if ($exitCode !== self::SUCCESS) {
                $this->error('Tenant migrations failed.');

                return self::FAILURE;
            }

            $tenant->makeCurrent();

            config(['seeder.tenant_admin_user' => $user]);

            $this->info('Seeding tenant permissions, admin role, and defaults...');
            $this->call('db:seed', [
                '--class' => TenantDatabaseSeeder::class,
                '--database' => 'tenant',
                '--force' => true,
            ]);

            Tenant::forgetCurrent();
            config(['seeder.tenant_admin_user' => null]);

            $this->info('Tenant setup complete!');
            $this->line("  Identifier : {$identifier}");
            $this->line("  Database   : {$dbName}");
            $this->line("  Admin      : {$email}");
            $this->line("  Password   : {$password}");
            $this->line('  Login URL  : '.Domain::auth());

            return self::SUCCESS;
        } catch (Throwable $e) {
            $this->error('Tenant setup failed: '.$e->getMessage());

            if (isset($tenant) && $tenant instanceof Tenant) {
                Tenant::forgetCurrent();
            }

            return self::FAILURE;
        }
    }

    protected function resolveAdminPassword(): string
    {
        $password = $this->option('password');

        if (is_string($password) && $password !== '') {
            return $password;
        }

        $alias = $this->option('admin_password');

        return is_string($alias) ? $alias : '';
    }

    protected function configureTenantConnection(string $database): void
    {
        Config::set('database.connections.tenant.database', $database);
        DB::purge('tenant');
        DB::reconnect('tenant');
    }
}
