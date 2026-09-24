<?php

namespace App\Console\Commands;

use App\Models\Lead;
use App\Models\Task;
use App\Models\Tenant;
use App\Services\LeadScoreCalculator;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;

#[Signature('leads:recalculate-scores {tenant? : Tenant id, identifier, or database name} {--all : Recalculate for every tenant}')]
#[Description('Recalculate persisted win-probability scores for leads')]
class RecalculateLeadScores extends Command
{
    public function handle(LeadScoreCalculator $calculator): int
    {
        if ($this->option('all')) {
            $tenants = Tenant::query()->whereNotNull('database')->get();

            foreach ($tenants as $tenant) {
                $this->recalculateTenant($tenant, $calculator);
            }

            return self::SUCCESS;
        }

        $tenantKey = (string) ($this->argument('tenant') ?? '');

        if ($tenantKey === '') {
            $this->error('Provide a tenant or pass --all.');

            return self::FAILURE;
        }

        $tenant = Tenant::query()
            ->where('id', $tenantKey)
            ->orWhere('identifier', $tenantKey)
            ->orWhere('database', $tenantKey)
            ->first();

        if (! $tenant) {
            $this->error("Tenant [{$tenantKey}] not found.");

            return self::FAILURE;
        }

        $this->recalculateTenant($tenant, $calculator);

        return self::SUCCESS;
    }

    protected function recalculateTenant(Tenant $tenant, LeadScoreCalculator $calculator): void
    {
        if (blank($tenant->database)) {
            $this->warn("Skipping {$tenant->identifier}: no database.");

            return;
        }

        $this->info("Recalculating scores for {$tenant->database} ({$tenant->identifier})");

        Config::set('database.connections.tenant.database', $tenant->database);
        DB::purge('tenant');
        DB::reconnect('tenant');
        $tenant->makeCurrent();

        $updated = 0;

        Lead::query()
            ->with(['stage', 'unit:id,price', 'tasks' => fn ($query) => $query
                ->where('type', Task::TYPE_ACTION)
                ->where('status', Task::STATUS_COMPLETED)
                ->latest('id')
                ->limit(50)])
            ->orderBy('id')
            ->chunkById(100, function ($leads) use ($calculator, &$updated): void {
                foreach ($leads as $lead) {
                    $calculator->apply($lead);
                    $updated++;
                }
            });

        Tenant::forgetCurrent();

        $this->info("Updated {$updated} leads.");
    }
}
