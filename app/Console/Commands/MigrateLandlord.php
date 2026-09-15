<?php

namespace App\Console\Commands;

use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

#[Signature('landlord:migrate {--fresh} {--seed}')]
#[Description('Run migrations for landlord database')]
class MigrateLandlord extends Command
{
    public function handle(): int
    {
        $this->info('Migrating landlord DB');

        DB::purge('landlord');
        DB::reconnect('landlord');

        $params = [
            '--database' => 'landlord',
            '--path' => '/database/migrations/landlord',
            '--force' => true,
        ];

        if ($this->option('fresh')) {
            $this->call('migrate:fresh', $params);
        } else {
            $this->call('migrate', $params);
        }

        if ($this->option('seed')) {
            $this->call('db:seed', [
                '--database' => 'landlord',
                '--force' => true,
            ]);
        }

        $this->info('Migration complete for landlord');

        return self::SUCCESS;
    }
}
