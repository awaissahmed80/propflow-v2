<?php

namespace App\Services;

use App\Models\Lead;
use App\Models\Order;
use App\Models\PaymentInstallment;
use App\Models\Task;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class TodoFeed
{
    public const WINDOW_OVERDUE = 'overdue';

    public const WINDOW_TODAY = 'today';

    public const WINDOW_WEEK = 'week';

    public const WINDOW_ALL = 'all';

    public const PER_PAGE = 10;

    /**
     * @return list<string>
     */
    public static function windows(): array
    {
        return [
            self::WINDOW_OVERDUE,
            self::WINDOW_TODAY,
            self::WINDOW_WEEK,
            self::WINDOW_ALL,
        ];
    }

    /**
     * @return array{
     *     items: list<array{
     *         id: string,
     *         source: string,
     *         title: string,
     *         subtitle: ?string,
     *         due_at: ?string,
     *         overdue: bool,
     *         href: ?string,
     *         icon: string
     *     }>,
     *     pagination: array{
     *         current_page: int,
     *         last_page: int,
     *         per_page: int,
     *         total: int,
     *         from: ?int,
     *         to: ?int
     *     }
     * }
     */
    public function forUser(User $user, string $window = self::WINDOW_WEEK, int $page = 1, int $perPage = self::PER_PAGE): array
    {
        $window = in_array($window, self::windows(), true) ? $window : self::WINDOW_WEEK;
        $perPage = max(1, $perPage);

        $items = $this->leadItems($user)
            ->concat($this->installmentItems($user))
            ->filter(fn (array $item): bool => $this->matchesWindow($item, $window))
            ->sortBy([
                ['overdue', 'desc'],
                fn (array $item): int => $item['due_at'] ? Carbon::parse($item['due_at'])->timestamp : PHP_INT_MAX,
            ])
            ->values();

        $total = $items->count();
        $lastPage = max(1, (int) ceil($total / $perPage));
        $page = max(1, min($page, $lastPage));
        $pageItems = $items->forPage($page, $perPage)->values()->all();

        return [
            'items' => $pageItems,
            'pagination' => [
                'current_page' => $page,
                'last_page' => $lastPage,
                'per_page' => $perPage,
                'total' => $total,
                'from' => $total === 0 ? null : (($page - 1) * $perPage) + 1,
                'to' => $total === 0 ? null : min($page * $perPage, $total),
            ],
        ];
    }

    /**
     * @return Collection<int, array{
     *     id: string,
     *     source: string,
     *     title: string,
     *     subtitle: ?string,
     *     due_at: ?string,
     *     overdue: bool,
     *     href: ?string,
     *     icon: string
     * }>
     */
    protected function leadItems(User $user): Collection
    {
        $horizon = now()->addDays(7)->endOfDay();

        $leads = Lead::query()
            ->active()
            ->with(['contact:id,first_name,last_name', 'project:id,title'])
            ->where('assigned_to', $user->id)
            ->whereNotNull('due_date')
            ->where('due_date', '<=', $horizon)
            ->where(function ($query): void {
                $query->whereNull('next_action')
                    ->orWhere('next_action', '!=', Lead::doNothingNextAction());
            })
            ->orderBy('due_date')
            ->limit(100)
            ->get();

        if ($leads->isEmpty()) {
            return collect();
        }

        $pendingActions = Task::query()
            ->where('type', Task::TYPE_ACTION)
            ->whereIn('status', [Task::STATUS_PENDING, Task::STATUS_IN_PROGRESS])
            ->where('taskable_type', (new Lead)->getMorphClass())
            ->whereIn('taskable_id', $leads->pluck('id')->all())
            ->orderBy('id')
            ->get()
            ->groupBy('taskable_id');

        return $leads->map(function (Lead $lead) use ($pendingActions): array {
            $name = trim(implode(' ', array_filter([
                $lead->contact?->first_name,
                $lead->contact?->last_name,
            ])));

            $pending = $pendingActions->get($lead->id)?->first();
            $actionLabel = $pending?->action ?: $lead->next_action;

            $subtitleParts = array_filter([
                $actionLabel,
                $lead->project?->title,
            ]);

            return [
                'id' => 'lead-'.$lead->id,
                'source' => 'lead',
                'title' => $name !== '' ? $name : 'Lead',
                'subtitle' => $subtitleParts !== [] ? implode(' · ', $subtitleParts) : null,
                'due_at' => $lead->due_date?->toIso8601String(),
                'overdue' => $lead->due_date !== null && $lead->due_date->lt(now()->startOfDay()),
                'href' => '/leads?lead='.$lead->code,
                'icon' => 'customer-service-line',
            ];
        });
    }

    /**
     * @return Collection<int, array{
     *     id: string,
     *     source: string,
     *     title: string,
     *     subtitle: ?string,
     *     due_at: ?string,
     *     overdue: bool,
     *     href: ?string,
     *     icon: string
     * }>
     */
    protected function installmentItems(User $user): Collection
    {
        $from = now()->subDays(7)->toDateString();
        $to = now()->addDays(7)->toDateString();

        return PaymentInstallment::query()
            ->with([
                'plan.order:id,code,assigned_to,status,contact_id,project_id',
                'plan.order.contact:id,first_name,last_name',
                'plan.order.project:id,title',
            ])
            ->where('status', PaymentInstallment::STATUS_PENDING)
            ->whereDate('due_on', '>=', $from)
            ->whereDate('due_on', '<=', $to)
            ->whereHas('plan.order', function ($query) use ($user): void {
                $query->where('assigned_to', $user->id)
                    ->where('status', '!=', Order::STATUS_CANCELLED);
            })
            ->orderBy('due_on')
            ->limit(100)
            ->get()
            ->map(function (PaymentInstallment $row): array {
                $order = $row->plan?->order;
                $code = $order?->code;
                $contactName = trim(implode(' ', array_filter([
                    $order?->contact?->first_name,
                    $order?->contact?->last_name,
                ])));

                $due = $row->due_on?->startOfDay();

                return [
                    'id' => 'installment-'.$row->id,
                    'source' => 'installment',
                    'title' => $row->label ?: 'Installment',
                    'subtitle' => collect([
                        $contactName !== '' ? $contactName : null,
                        $order?->project?->title,
                        $code,
                    ])->filter()->implode(' · ') ?: null,
                    'due_at' => $due?->toIso8601String(),
                    'overdue' => $due !== null && $due->lt(now()->startOfDay()),
                    'href' => $code ? '/bookings?booking='.$code : null,
                    'icon' => 'money-dollar-circle-line',
                ];
            });
    }

    /**
     * @param  array{due_at: ?string, overdue: bool}  $item
     */
    protected function matchesWindow(array $item, string $window): bool
    {
        if ($window === self::WINDOW_ALL) {
            return true;
        }

        if ($window === self::WINDOW_OVERDUE) {
            return $item['overdue'];
        }

        if ($item['due_at'] === null) {
            return false;
        }

        $due = Carbon::parse($item['due_at']);

        if ($window === self::WINDOW_TODAY) {
            return $due->isSameDay(now());
        }

        // week: overdue already included via due_at <= horizon in queries;
        // filter keeps items due within the next 7 days OR overdue
        return $item['overdue'] || $due->lte(now()->addDays(7)->endOfDay());
    }
}
