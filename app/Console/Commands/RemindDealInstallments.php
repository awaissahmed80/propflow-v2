<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Services\DealPipeline;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('deals:remind')]
#[Description('Remind buyers seven days before an installment is due')]
class RemindDealInstallments extends Command
{
    public function handle(DealPipeline $pipeline): int
    {
        $sent = 0;

        Tenant::query()->orderBy('id')->each(function (Tenant $tenant) use ($pipeline, &$sent): void {
            $tenant->makeCurrent();

            try {
                $sent += $pipeline->remindDueSoon();
            } finally {
                Tenant::forgetCurrent();
            }
        });

        $this->info('Sent '.$sent.' installment reminders.');

        return self::SUCCESS;
    }
}
