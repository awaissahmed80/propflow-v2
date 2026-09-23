<?php

namespace App\Services;

use App\Models\Lead;
use App\Models\Order;
use App\Models\PaymentInstallment;
use App\Models\PersonalReminder;
use App\Models\User;
use App\Support\Notifications\WorkspaceNotifier;

class CriticalDueNotifier
{
    /**
     * Push in-app alerts for due personal reminders, lead follow-ups, and overdue installments.
     */
    public function notify(): int
    {
        return $this->personalReminders() + $this->leadFollowUps() + $this->overdueInstallments();
    }

    /**
     * Notify the owner when a personal reminder is due (or overdue).
     */
    public function notifyPersonalReminder(PersonalReminder $reminder): int
    {
        if ($reminder->isCompleted() || $reminder->due_at === null || $reminder->due_at->gt(now())) {
            return 0;
        }

        $user = User::query()->find($reminder->user_id);

        if ($user === null) {
            return 0;
        }

        $overdue = $reminder->due_at->lt(now()->startOfDay());
        $event = $overdue ? 'personal_reminder_overdue' : 'personal_reminder_due';
        $title = $overdue ? 'Reminder overdue' : 'Reminder due';
        $reference = $event.':'.$reminder->id.':'.now()->toDateString();

        return WorkspaceNotifier::send(
            $event,
            $title,
            $reminder->title,
            '/todos',
            collect([$user]),
            includeActor: true,
            reference: $reference,
        );
    }

    protected function personalReminders(): int
    {
        $sent = 0;

        PersonalReminder::query()
            ->open()
            ->whereNotNull('due_at')
            ->where('due_at', '<=', now())
            ->orderBy('id')
            ->chunkById(100, function ($reminders) use (&$sent): void {
                foreach ($reminders as $reminder) {
                    /** @var PersonalReminder $reminder */
                    $sent += $this->notifyPersonalReminder($reminder);
                }
            });

        return $sent;
    }

    protected function leadFollowUps(): int
    {
        $sent = 0;
        $today = now()->toDateString();
        $horizon = now()->endOfDay();

        Lead::query()
            ->active()
            ->with(['contact:id,first_name,last_name'])
            ->whereNotNull('assigned_to')
            ->whereNotNull('due_date')
            ->where('due_date', '<=', $horizon)
            ->where(function ($query): void {
                $query->whereNull('next_action')
                    ->orWhere('next_action', '!=', Lead::doNothingNextAction());
            })
            ->orderBy('id')
            ->chunkById(100, function ($leads) use (&$sent, $today): void {
                foreach ($leads as $lead) {
                    /** @var Lead $lead */
                    $user = User::query()->find($lead->assigned_to);

                    if ($user === null || $lead->due_date === null) {
                        continue;
                    }

                    $overdue = $lead->due_date->lt(now()->startOfDay());
                    $event = $overdue ? 'follow_up_overdue' : 'follow_up_due';
                    $name = trim(implode(' ', array_filter([
                        $lead->contact?->first_name,
                        $lead->contact?->last_name,
                    ])));
                    $label = $name !== '' ? $name : 'Lead';
                    $action = filled($lead->next_action) ? (string) $lead->next_action : 'Follow up';
                    $title = $overdue ? 'Follow-up overdue' : 'Follow-up due';
                    $body = $label.' · '.$action;
                    $href = '/leads?lead='.$lead->code;
                    $reference = $event.':lead:'.$lead->id.':'.$today;

                    $sent += WorkspaceNotifier::send(
                        $event,
                        $title,
                        $body,
                        $href,
                        collect([$user]),
                        includeActor: true,
                        reference: $reference,
                    );
                }
            });

        return $sent;
    }

    protected function overdueInstallments(): int
    {
        $sent = 0;
        $today = now()->toDateString();

        PaymentInstallment::query()
            ->with([
                'plan.order:id,code,assigned_to,status,contact_id,stage',
                'plan.order.contact:id,first_name,last_name',
            ])
            ->where('status', PaymentInstallment::STATUS_PENDING)
            ->whereDate('due_on', '<', $today)
            ->whereHas('plan.order', function ($query): void {
                $query->whereNotNull('assigned_to')
                    ->where('status', '!=', Order::STATUS_CANCELLED)
                    ->whereIn('stage', Order::liaisonStages());
            })
            ->orderBy('id')
            ->chunkById(100, function ($rows) use (&$sent, $today): void {
                foreach ($rows as $row) {
                    /** @var PaymentInstallment $row */
                    $order = $row->plan?->order;

                    if ($order === null || $order->assigned_to === null) {
                        continue;
                    }

                    $user = User::query()->find($order->assigned_to);

                    if ($user === null) {
                        continue;
                    }

                    $contactName = trim(implode(' ', array_filter([
                        $order->contact?->first_name,
                        $order->contact?->last_name,
                    ])));
                    $label = $row->label ?: 'Installment';
                    $body = ($contactName !== '' ? $contactName.' · ' : '').$label.' was due '.$row->due_on?->toDateString();
                    $reference = 'installment_overdue:'.$row->id.':'.$today;

                    $sent += WorkspaceNotifier::send(
                        'installment_overdue',
                        'Installment overdue',
                        $body,
                        '/bookings?booking='.$order->code,
                        collect([$user]),
                        includeActor: true,
                        reference: $reference,
                    );
                }
            });

        return $sent;
    }
}
