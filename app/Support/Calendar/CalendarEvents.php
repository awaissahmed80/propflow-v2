<?php

namespace App\Support\Calendar;

use App\Models\Campaign;
use App\Models\Lead;
use App\Models\Order;
use App\Models\OrderPayment;
use App\Models\OrderTransfer;
use App\Models\PaymentInstallment;
use App\Models\Project;
use App\Models\ProjectProgress;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class CalendarEvents
{
    public const MODULE_LEADS = 'leads';

    public const MODULE_ORDERS = 'orders';

    public const MODULE_PAYMENTS = 'payments';

    public const MODULE_CAMPAIGNS = 'campaigns';

    public const MODULE_PROJECTS = 'projects';

    /**
     * @var array<string, string>
     */
    public const COLORS = [
        self::MODULE_LEADS => 'yellow',
        self::MODULE_ORDERS => 'blue',
        self::MODULE_PAYMENTS => 'emerald',
        self::MODULE_CAMPAIGNS => 'violet',
        self::MODULE_PROJECTS => 'slate',
    ];

    /**
     * @return list<string>
     */
    public static function modules(): array
    {
        return array_keys(self::COLORS);
    }

    /**
     * @param  list<int>  $assigneeIds
     * @param  list<string>  $types
     * @return array{
     *     monthMarkers: array<string, list<string>>,
     *     dayEvents: list<array<string, mixed>>
     * }
     */
    public function aggregate(
        CarbonInterface $monthStart,
        CarbonInterface $monthEnd,
        CarbonInterface $dayStart,
        CarbonInterface $dayEnd,
        array $assigneeIds = [],
        array $types = [],
        bool $overdueOnly = false,
    ): array {
        $types = $types === []
            ? self::modules()
            : array_values(array_intersect(self::modules(), $types));

        $events = collect();

        if (in_array(self::MODULE_LEADS, $types, true)) {
            $events = $events->merge($this->leadEvents($monthStart, $monthEnd, $assigneeIds));
        }

        if (in_array(self::MODULE_ORDERS, $types, true)) {
            $events = $events->merge($this->orderEvents($monthStart, $monthEnd, $assigneeIds));
        }

        if (in_array(self::MODULE_PAYMENTS, $types, true)) {
            $events = $events->merge($this->paymentEvents($monthStart, $monthEnd, $assigneeIds));
        }

        if (in_array(self::MODULE_CAMPAIGNS, $types, true)) {
            $events = $events->merge($this->campaignEvents($monthStart, $monthEnd, $assigneeIds));
        }

        if (in_array(self::MODULE_PROJECTS, $types, true)) {
            $events = $events->merge($this->projectEvents($monthStart, $monthEnd));
        }

        if ($overdueOnly) {
            $events = $events->filter(fn (array $event): bool => $event['overdue'] === true)->values();
        }

        $monthMarkers = $this->markersForMonth($events, $monthStart, $monthEnd);
        $dayEvents = $events
            ->filter(fn (array $event): bool => $this->touchesDay($event, $dayStart, $dayEnd))
            ->sortBy(fn (array $event): string => $event['when'] ?? '')
            ->values()
            ->all();

        return [
            'monthMarkers' => $monthMarkers,
            'dayEvents' => $dayEvents,
        ];
    }

    /**
     * @param  list<int>  $assigneeIds
     * @return Collection<int, array<string, mixed>>
     */
    protected function leadEvents(CarbonInterface $from, CarbonInterface $to, array $assigneeIds): Collection
    {
        $fields = [
            'due_date' => 'Due',
            'contacted_at' => 'Contacted',
            'archived_at' => 'Archived',
        ];

        $events = collect();

        foreach ($fields as $field => $label) {
            $leads = Lead::query()
                ->with(['contact:id,first_name,last_name', 'assignee:id,display_name,first_name,last_name'])
                ->whereNotNull($field)
                ->whereBetween($field, [$from, $to])
                ->when($assigneeIds !== [], fn ($query) => $query->whereIn('assigned_to', $assigneeIds))
                ->get();

            foreach ($leads as $lead) {
                /** @var CarbonInterface|null $when */
                $when = $lead->{$field};

                if ($when === null) {
                    continue;
                }

                $contactName = $lead->contact
                    ? trim($lead->contact->first_name.' '.$lead->contact->last_name) ?: 'Lead'
                    : 'Lead';

                $overdue = $field === 'due_date' && $when->lt(now()->startOfDay());

                $events->push($this->event(
                    id: 'lead-'.$field.'-'.$lead->id,
                    module: self::MODULE_LEADS,
                    title: $contactName,
                    subtitle: $label.($lead->next_action ? ' · '.$lead->next_action : ''),
                    when: $when,
                    allDay: false,
                    overdue: $overdue,
                    assignee: $this->assigneePayload($lead->assignee),
                    href: '/leads?lead='.$lead->code,
                    subject: ['type' => 'lead', 'code' => $lead->code],
                ));
            }
        }

        return $events;
    }

    /**
     * @param  list<int>  $assigneeIds
     * @return Collection<int, array<string, mixed>>
     */
    protected function orderEvents(CarbonInterface $from, CarbonInterface $to, array $assigneeIds): Collection
    {
        $fields = [
            'booked_at' => 'Booked',
            'booking_verified_at' => 'Booking verified',
            'allocated_at' => 'Allocated',
            'balloted_at' => 'Balloted',
            'handover_ready_at' => 'Handover ready',
            'delivered_at' => 'Delivered',
            'cancelled_at' => 'Cancelled',
        ];

        $events = collect();

        $orders = Order::query()
            ->with([
                'contact:id,first_name,last_name',
                'assignee:id,display_name,first_name,last_name',
                'unit:id,code,name',
            ])
            ->when($assigneeIds !== [], fn ($query) => $query->whereIn('assigned_to', $assigneeIds))
            ->where(function ($query) use ($fields, $from, $to): void {
                foreach ($fields as $field => $label) {
                    $query->orWhere(function ($inner) use ($field, $from, $to): void {
                        $inner->whereNotNull($field)->whereBetween($field, [$from, $to]);
                    });
                }
            })
            ->get();

        foreach ($orders as $order) {
            foreach ($fields as $field => $label) {
                /** @var CarbonInterface|null $when */
                $when = $order->{$field};

                if ($when === null || $when->lt($from) || $when->gt($to)) {
                    continue;
                }

                $events->push($this->event(
                    id: 'order-'.$field.'-'.$order->id,
                    module: self::MODULE_ORDERS,
                    title: $this->personName($order->contact),
                    subtitle: $label.($order->unit?->name ? ' · '.$order->unit->name : ''),
                    when: $when,
                    allDay: false,
                    overdue: false,
                    assignee: $this->assigneePayload($order->assignee),
                    href: '/bookings/'.$order->code,
                    subject: ['type' => 'order', 'code' => $order->code],
                ));
            }
        }

        $transfers = OrderTransfer::query()
            ->with([
                'order:id,code,assigned_to',
                'order.assignee:id,display_name,first_name,last_name',
                'order.contact:id,first_name,last_name',
            ])
            ->whereNotNull('transferred_at')
            ->whereBetween('transferred_at', [$from, $to])
            ->when(
                $assigneeIds !== [],
                fn ($query) => $query->whereHas(
                    'order',
                    fn ($orderQuery) => $orderQuery->whereIn('assigned_to', $assigneeIds),
                ),
            )
            ->get();

        foreach ($transfers as $transfer) {
            $order = $transfer->order;

            if ($order === null || $transfer->transferred_at === null) {
                continue;
            }

            $events->push($this->event(
                id: 'order-transfer-'.$transfer->id,
                module: self::MODULE_ORDERS,
                title: $this->personName($order->contact),
                subtitle: 'Transferred',
                when: $transfer->transferred_at,
                allDay: false,
                overdue: false,
                assignee: $this->assigneePayload($order->assignee),
                href: '/bookings/'.$order->code,
                subject: ['type' => 'order', 'code' => $order->code],
            ));
        }

        return $events;
    }

    /**
     * @param  list<int>  $assigneeIds
     * @return Collection<int, array<string, mixed>>
     */
    protected function paymentEvents(CarbonInterface $from, CarbonInterface $to, array $assigneeIds): Collection
    {
        $events = collect();

        $installments = PaymentInstallment::query()
            ->with([
                'plan.order:id,code,assigned_to',
                'plan.order.assignee:id,display_name,first_name,last_name',
                'plan.order.contact:id,first_name,last_name',
            ])
            ->where(function ($query) use ($from, $to): void {
                $query->where(function ($inner) use ($from, $to): void {
                    $inner->whereNotNull('due_on')->whereBetween('due_on', [$from->toDateString(), $to->toDateString()]);
                })->orWhere(function ($inner) use ($from, $to): void {
                    $inner->whereNotNull('paid_at')->whereBetween('paid_at', [$from, $to]);
                })->orWhere(function ($inner) use ($from, $to): void {
                    $inner->whereNotNull('reminded_at')->whereBetween('reminded_at', [$from, $to]);
                });
            })
            ->when(
                $assigneeIds !== [],
                fn ($query) => $query->whereHas(
                    'plan.order',
                    fn ($orderQuery) => $orderQuery->whereIn('assigned_to', $assigneeIds),
                ),
            )
            ->get();

        foreach ($installments as $installment) {
            $order = $installment->plan?->order;

            if ($order === null) {
                continue;
            }

            $assignee = $this->assigneePayload($order->assignee);
            $subject = ['type' => 'order', 'code' => $order->code];
            $href = '/bookings/'.$order->code;

            if ($installment->due_on !== null
                && $installment->due_on->betweenIncluded($from->copy()->startOfDay(), $to->copy()->endOfDay())
            ) {
                $due = $installment->due_on->copy()->startOfDay();
                $overdue = $installment->isPending() && $due->lt(now()->startOfDay());

                $events->push($this->event(
                    id: 'payment-due-'.$installment->id,
                    module: self::MODULE_PAYMENTS,
                    title: $installment->label ?: 'Installment #'.$installment->sequence,
                    subtitle: 'Due · '.$this->personName($order->contact),
                    when: $due,
                    allDay: true,
                    overdue: $overdue,
                    assignee: $assignee,
                    href: $href,
                    subject: $subject,
                ));
            }

            if ($installment->paid_at !== null && $installment->paid_at->betweenIncluded($from, $to)) {
                $events->push($this->event(
                    id: 'payment-paid-'.$installment->id,
                    module: self::MODULE_PAYMENTS,
                    title: $installment->label ?: 'Installment #'.$installment->sequence,
                    subtitle: 'Paid · '.$this->personName($order->contact),
                    when: $installment->paid_at,
                    allDay: false,
                    overdue: false,
                    assignee: $assignee,
                    href: $href,
                    subject: $subject,
                ));
            }

            if ($installment->reminded_at !== null && $installment->reminded_at->betweenIncluded($from, $to)) {
                $events->push($this->event(
                    id: 'payment-reminded-'.$installment->id,
                    module: self::MODULE_PAYMENTS,
                    title: $installment->label ?: 'Installment #'.$installment->sequence,
                    subtitle: 'Reminded · '.$this->personName($order->contact),
                    when: $installment->reminded_at,
                    allDay: false,
                    overdue: false,
                    assignee: $assignee,
                    href: $href,
                    subject: $subject,
                ));
            }
        }

        $payments = OrderPayment::query()
            ->with([
                'order:id,code,assigned_to',
                'order.contact:id,first_name,last_name',
                'order.assignee:id,display_name,first_name,last_name',
            ])
            ->whereNotNull('paid_on')
            ->whereBetween('paid_on', [$from->toDateString(), $to->toDateString()])
            ->when(
                $assigneeIds !== [],
                fn ($query) => $query->whereHas(
                    'order',
                    fn ($orderQuery) => $orderQuery->whereIn('assigned_to', $assigneeIds),
                ),
            )
            ->get();

        foreach ($payments as $payment) {
            $order = $payment->order;

            if ($order === null || $payment->paid_on === null) {
                continue;
            }

            $events->push($this->event(
                id: 'order-payment-'.$payment->id,
                module: self::MODULE_PAYMENTS,
                title: 'Payment received',
                subtitle: $this->personName($order->contact).($payment->method ? ' · '.$payment->method : ''),
                when: $payment->paid_on->copy()->startOfDay(),
                allDay: true,
                overdue: false,
                assignee: $this->assigneePayload($order->assignee),
                href: '/bookings/'.$order->code,
                subject: ['type' => 'order', 'code' => $order->code],
            ));
        }

        return $events;
    }

    /**
     * @param  list<int>  $assigneeIds
     * @return Collection<int, array<string, mixed>>
     */
    protected function campaignEvents(CarbonInterface $from, CarbonInterface $to, array $assigneeIds): Collection
    {
        $campaigns = Campaign::query()
            ->with(['owner:id,display_name,first_name,last_name', 'project:id,title,code'])
            ->whereNotNull('starts_at')
            ->where('starts_at', '<=', $to)
            ->where(function ($query) use ($from): void {
                $query->whereNull('ends_at')->orWhere('ends_at', '>=', $from);
            })
            ->when($assigneeIds !== [], fn ($query) => $query->whereIn('owner_id', $assigneeIds))
            ->get();

        return $campaigns->map(function (Campaign $campaign) use ($from): array {
            $start = $campaign->starts_at ?? $from;
            $end = $campaign->ends_at;

            return $this->event(
                id: 'campaign-'.$campaign->id,
                module: self::MODULE_CAMPAIGNS,
                title: $campaign->title,
                subtitle: $campaign->status.($campaign->project ? ' · '.$campaign->project->title : ''),
                when: $start,
                end: $end,
                allDay: false,
                overdue: false,
                assignee: $this->assigneePayload($campaign->owner),
                href: '/campaigns/'.$campaign->slug,
                subject: ['type' => 'campaign', 'code' => $campaign->slug],
            );
        });
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    protected function projectEvents(CarbonInterface $from, CarbonInterface $to): Collection
    {
        $events = collect();

        $projects = Project::query()
            ->where(function ($query) use ($from, $to): void {
                $query->where(function ($inner) use ($from, $to): void {
                    $inner->whereNotNull('start_date')
                        ->where('start_date', '<=', $to->toDateString())
                        ->where(function ($range) use ($from): void {
                            $range->whereNull('end_date')->orWhere('end_date', '>=', $from->toDateString());
                        });
                })->orWhere(function ($inner) use ($from, $to): void {
                    $inner->whereNotNull('end_date')
                        ->whereBetween('end_date', [$from->toDateString(), $to->toDateString()]);
                });
            })
            ->get(['id', 'code', 'title', 'status', 'start_date', 'end_date']);

        foreach ($projects as $project) {
            $start = $this->parseDate($project->start_date);
            $end = $this->parseDate($project->end_date);

            if ($start === null && $end === null) {
                continue;
            }

            $when = $start ?? $end;
            $events->push($this->event(
                id: 'project-'.$project->id,
                module: self::MODULE_PROJECTS,
                title: $project->title,
                subtitle: $project->status ?: 'Project',
                when: $when,
                end: $end,
                allDay: true,
                overdue: false,
                assignee: null,
                href: '/projects/'.$project->code,
                subject: ['type' => 'project', 'code' => $project->code],
            ));
        }

        $phases = ProjectProgress::query()
            ->with(['project:id,code,title'])
            ->where(function ($query) use ($from, $to): void {
                $query->where(function ($inner) use ($from, $to): void {
                    $inner->whereNotNull('start_date')
                        ->where('start_date', '<=', $to)
                        ->where(function ($range) use ($from): void {
                            $range->whereNull('end_date')->orWhere('end_date', '>=', $from);
                        });
                })->orWhere(function ($inner) use ($from, $to): void {
                    $inner->whereNotNull('end_date')->whereBetween('end_date', [$from, $to]);
                });
            })
            ->get();

        foreach ($phases as $phase) {
            $project = $phase->project;

            if ($project === null) {
                continue;
            }

            $start = $phase->start_date;
            $end = $phase->end_date;

            if ($start === null && $end === null) {
                continue;
            }

            $events->push($this->event(
                id: 'phase-'.$phase->id,
                module: self::MODULE_PROJECTS,
                title: $phase->title,
                subtitle: 'Phase · '.$project->title,
                when: $start ?? $end,
                end: $end,
                allDay: true,
                overdue: false,
                assignee: null,
                href: '/projects/'.$project->code,
                subject: ['type' => 'project', 'code' => $project->code],
            ));
        }

        return $events;
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $events
     * @return array<string, list<string>>
     */
    protected function markersForMonth(Collection $events, CarbonInterface $monthStart, CarbonInterface $monthEnd): array
    {
        /** @var array<string, array<string, true>> $markers */
        $markers = [];

        foreach ($events as $event) {
            $module = (string) $event['module'];
            $color = self::COLORS[$module] ?? 'slate';
            $when = Carbon::parse($event['when']);
            $end = isset($event['end']) && $event['end'] !== null
                ? Carbon::parse($event['end'])
                : $when->copy();

            $cursor = $when->copy()->startOfDay()->max($monthStart->copy()->startOfDay());
            $last = $end->copy()->startOfDay()->min($monthEnd->copy()->startOfDay());

            while ($cursor->lte($last)) {
                $key = $cursor->toDateString();
                $markers[$key][$color] = true;
                $cursor->addDay();
            }
        }

        return collect($markers)
            ->map(fn (array $colors): array => array_keys($colors))
            ->all();
    }

    /**
     * @param  array<string, mixed>  $event
     */
    protected function touchesDay(array $event, CarbonInterface $dayStart, CarbonInterface $dayEnd): bool
    {
        $when = Carbon::parse($event['when']);
        $end = isset($event['end']) && $event['end'] !== null
            ? Carbon::parse($event['end'])
            : $when->copy();

        return $when->lte($dayEnd) && $end->gte($dayStart);
    }

    /**
     * @param  array{type: string, code: string}  $subject
     * @return array<string, mixed>
     */
    protected function event(
        string $id,
        string $module,
        string $title,
        string $subtitle,
        CarbonInterface $when,
        ?CarbonInterface $end = null,
        bool $allDay = false,
        bool $overdue = false,
        ?array $assignee = null,
        string $href = '',
        array $subject = [],
    ): array {
        return [
            'id' => $id,
            'module' => $module,
            'color' => self::COLORS[$module] ?? 'slate',
            'title' => $title,
            'subtitle' => $subtitle,
            'when' => $when->toIso8601String(),
            'end' => $end?->toIso8601String(),
            'allDay' => $allDay,
            'overdue' => $overdue,
            'assignee' => $assignee,
            'href' => $href,
            'subject' => $subject,
        ];
    }

    protected function personName(mixed $contact, string $fallback = 'Booking'): string
    {
        if ($contact === null) {
            return $fallback;
        }

        $name = trim(($contact->first_name ?? '').' '.($contact->last_name ?? ''));

        return $name !== '' ? $name : $fallback;
    }

    /**
     * @return array{id: int, display_name: string}|null
     */
    protected function assigneePayload(?User $user): ?array
    {
        if ($user === null) {
            return null;
        }

        $name = $user->display_name
            ?: trim($user->first_name.' '.$user->last_name)
            ?: 'User #'.$user->id;

        return [
            'id' => $user->id,
            'display_name' => $name,
        ];
    }

    protected function parseDate(mixed $value): ?CarbonInterface
    {
        if ($value === null || $value === '') {
            return null;
        }

        if ($value instanceof CarbonInterface) {
            return $value;
        }

        try {
            return Carbon::parse($value)->startOfDay();
        } catch (\Throwable) {
            return null;
        }
    }
}
