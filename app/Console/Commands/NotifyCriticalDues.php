<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Services\CriticalDueNotifier;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('todos:notify-due')]
#[Description('Notify users about due personal reminders and critical lead follow-ups')]
class NotifyCriticalDues extends Command
{
    public function handle(CriticalDueNotifier $notifier): int
    {
        $sent = 0;

        Tenant::query()->orderBy('id')->each(function (Tenant $tenant) use ($notifier, &$sent): void {
            $tenant->makeCurrent();

            try {
                $sent += $notifier->notify();
            } finally {
                Tenant::forgetCurrent();
            }
        });

        $this->info('Sent '.$sent.' due-task notifications.');

        return self::SUCCESS;
    }
}
