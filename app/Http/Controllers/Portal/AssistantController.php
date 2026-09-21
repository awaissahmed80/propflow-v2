<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\InterpretAssistantRequest;
use App\Models\Lead;
use App\Models\Order;
use App\Models\PaymentInstallment;
use App\Models\Project;
use App\Models\Task;
use App\Models\Tenant;
use App\Models\User;
use App\Support\Assistant\AssistantInterpreter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;

class AssistantController extends Controller
{
    public function __construct(protected AssistantInterpreter $interpreter) {}

    public function brief(Request $request): JsonResponse
    {
        return response()->json($this->briefFor($request->user()));
    }

    public function interpret(InterpretAssistantRequest $request): JsonResponse
    {
        $projects = Project::query()
            ->orderBy('title')
            ->get(['id', 'code', 'title'])
            ->map(fn (Project $project): array => [
                'id' => (int) $project->id,
                'code' => (string) $project->code,
                'title' => (string) $project->title,
            ])
            ->all();

        $intentHint = $request->validated('intent_hint');
        $intentScore = $request->validated('intent_score');

        if ($intentHint !== null && $intentScore !== null && (float) $intentScore < 0.42) {
            $intentHint = null;
        }

        $result = $this->interpreter->interpret(
            $request->validated('transcript'),
            $projects,
            $request->validated('context') ?? [],
            $intentHint,
        );
        $user = $request->user();

        if (in_array($result['intent'], [
            AssistantInterpreter::INTENT_WORK,
            AssistantInterpreter::INTENT_REMINDERS,
        ], true)) {
            $result['data'] = $this->briefFor($user)[$result['intent']];
        }

        if ($result['intent'] === AssistantInterpreter::INTENT_PROGRESS) {
            $progress = $this->briefFor($user)['progress'];
            $result['data'] = $progress;
            $result['prompt'] = sprintf(
                'You have %d open leads, %d overdue, and %d closed deals.',
                $progress['open_leads'],
                $progress['overdue'],
                $progress['closed_deals'],
            );
        }

        if ($result['intent'] === AssistantInterpreter::INTENT_CALENDAR) {
            $events = $this->calendarFor($user);
            $result['data'] = $events;

            if ($events === []) {
                $result['prompt'] = 'You have nothing on your calendar.';
            }
        }

        if ($result['intent'] === AssistantInterpreter::INTENT_DEALS) {
            $deals = $this->dealsFor($user);
            $result['data'] = $deals;

            if ($deals === []) {
                $result['prompt'] = 'You have no open deals.';
            }
        }

        if ($result['intent'] === AssistantInterpreter::INTENT_FIND_LEAD && $result['missing'] === []) {
            $matches = $this->leadsMatching((string) ($result['slots']['query'] ?? ''));
            $result['data'] = $matches;

            if ($matches === []) {
                $result['prompt'] = 'I could not find that lead.';
            }
        }

        if ($result['intent'] === AssistantInterpreter::INTENT_LOG_ACTIVITY && $result['missing'] === []) {
            $matches = $this->leadsMatching((string) ($result['slots']['query'] ?? ''));

            if (count($matches) === 1) {
                $result['slots']['lead_code'] = $matches[0]['code'];
                $result['slots']['lead_name'] = $matches[0]['name'];
                $result['data'] = $matches;
            } elseif ($matches === []) {
                $result['missing'] = ['lead'];
                $result['prompt'] = 'I could not find that lead. Who was it for?';
                $result['confirm'] = false;
                $result['ask'] = null;
                $result['options'] = [];
            } else {
                $result['missing'] = ['lead'];
                $result['prompt'] = 'I found a few leads. Which one?';
                $result['confirm'] = false;
                $result['ask'] = null;
                $result['options'] = [];
                $result['data'] = $matches;
            }
        }

        return response()->json($result);
    }

    /**
     * @return array{
     *     work: array{leads: list<array<string, mixed>>, tasks: list<array<string, mixed>>, installments: list<array<string, mixed>>},
     *     progress: array{open_leads: int, overdue: int, closed_deals: int},
     *     reminders: list<array<string, mixed>>
     * }
     */
    protected function briefFor(User $user): array
    {
        return [
            'work' => $this->workFor($user),
            'progress' => $this->progressFor($user),
            'reminders' => $this->remindersFor($user),
        ];
    }

    /**
     * @return array{leads: list<array<string, mixed>>, tasks: list<array<string, mixed>>, installments: list<array<string, mixed>>}
     */
    protected function workFor(User $user): array
    {
        $todayEnd = now()->endOfDay();
        $dueLeads = Lead::query()
            ->active()
            ->with('contact:id,first_name,last_name')
            ->where('assigned_to', $user->id)
            ->whereNotNull('due_date')
            ->where('due_date', '<=', $todayEnd)
            ->where(function ($query): void {
                $query->whereNull('next_action')
                    ->orWhere('next_action', '!=', Lead::doNothingNextAction());
            })
            ->orderBy('due_date')
            ->limit(20)
            ->get();

        $leadIds = $dueLeads->pluck('id')->all();

        $tasks = $leadIds === []
            ? collect()
            : Task::query()
                ->with('lead:id,code')
                ->where('user_id', $user->id)
                ->whereIn('status', [Task::STATUS_PENDING, Task::STATUS_IN_PROGRESS])
                ->whereIn('lead_id', $leadIds)
                ->orderBy('id')
                ->limit(20)
                ->get();

        $installments = PaymentInstallment::query()
            ->with('plan.order:id,code')
            ->where('status', PaymentInstallment::STATUS_PENDING)
            ->whereDate('due_on', '>=', now()->toDateString())
            ->whereDate('due_on', '<=', now()->addDays(7)->toDateString())
            ->whereHas('plan.order', function ($query) use ($user): void {
                $query->where('assigned_to', $user->id)
                    ->where('status', '!=', Order::STATUS_CANCELLED);
            })
            ->orderBy('due_on')
            ->limit(20)
            ->get();

        return [
            'leads' => $dueLeads->map(function (Lead $lead): array {
                $name = trim(implode(' ', array_filter([
                    $lead->contact?->first_name,
                    $lead->contact?->last_name,
                ])));

                return [
                    'code' => $lead->code,
                    'name' => $name !== '' ? $name : $lead->code,
                    'due_date' => $lead->due_date?->toIso8601String(),
                    'overdue' => $lead->due_date !== null && $lead->due_date->lt(now()->startOfDay()),
                    'href' => '/leads?lead='.$lead->code,
                ];
            })->values()->all(),
            'tasks' => $tasks->map(function (Task $task): array {
                $code = $task->lead?->code;

                return [
                    'action' => $task->action,
                    'status' => $task->status,
                    'lead_code' => $code,
                    'href' => $code ? '/leads?lead='.$code : null,
                ];
            })->values()->all(),
            'installments' => $installments->map(function (PaymentInstallment $row): array {
                $code = $row->plan?->order?->code;

                return [
                    'label' => $row->label,
                    'amount' => (float) $row->amount,
                    'due_on' => $row->due_on?->toDateString(),
                    'order_code' => $code,
                    'href' => $code ? '/bookings/'.$code : null,
                ];
            })->values()->all(),
        ];
    }

    /**
     * @return array{open_leads: int, overdue: int, closed_deals: int}
     */
    protected function progressFor(User $user): array
    {
        $assigned = Lead::query()->active()->where('assigned_to', $user->id);

        return [
            'open_leads' => (clone $assigned)->count(),
            'overdue' => (clone $assigned)
                ->whereNotNull('due_date')
                ->where('due_date', '<', now()->startOfDay())
                ->where(function ($query): void {
                    $query->whereNull('next_action')
                        ->orWhere('next_action', '!=', Lead::doNothingNextAction());
                })
                ->count(),
            'closed_deals' => Order::query()
                ->where('assigned_to', $user->id)
                ->whereIn('status', [Order::STATUS_ALLOCATED, Order::STATUS_DELIVERED])
                ->count(),
        ];
    }

    /**
     * @return list<array{id: string, title: string, body: string, href: ?string, created_at: ?string}>
     */
    protected function remindersFor(User $user): array
    {
        $tenantId = Tenant::current()?->id;

        return $user->unreadNotifications()
            ->where('data->tenant_id', $tenantId)
            ->latest()
            ->limit(15)
            ->get()
            ->map(function (DatabaseNotification $notification): array {
                $data = is_array($notification->data) ? $notification->data : [];

                return [
                    'id' => $notification->id,
                    'title' => (string) ($data['title'] ?? 'Notification'),
                    'body' => (string) ($data['body'] ?? ''),
                    'href' => $data['href'] ?? null,
                    'created_at' => $notification->created_at?->toIso8601String(),
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @return list<array{name: string, action: ?string, when: ?string, overdue: bool, code: string, href: string}>
     */
    protected function calendarFor(User $user): array
    {
        return Lead::query()
            ->active()
            ->with('contact:id,first_name,last_name')
            ->where('assigned_to', $user->id)
            ->whereNotNull('due_date')
            ->where('due_date', '<=', now()->addDays(7)->endOfDay())
            ->where(function ($query): void {
                $query->whereNull('next_action')
                    ->orWhere('next_action', '!=', Lead::doNothingNextAction());
            })
            ->orderBy('due_date')
            ->limit(20)
            ->get()
            ->map(function (Lead $lead): array {
                $name = trim(implode(' ', array_filter([
                    $lead->contact?->first_name,
                    $lead->contact?->last_name,
                ])));

                return [
                    'name' => $name !== '' ? $name : $lead->code,
                    'action' => $lead->next_action,
                    'when' => $lead->due_date?->toIso8601String(),
                    'overdue' => $lead->due_date !== null && $lead->due_date->lt(now()->startOfDay()),
                    'code' => $lead->code,
                    'href' => '/leads?lead='.$lead->code,
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @return list<array{name: string, status: string, code: string, href: string}>
     */
    protected function dealsFor(User $user): array
    {
        return Order::query()
            ->with('contact:id,first_name,last_name')
            ->where('assigned_to', $user->id)
            ->where('status', '!=', Order::STATUS_CANCELLED)
            ->latest('id')
            ->limit(8)
            ->get()
            ->map(function (Order $order): array {
                $name = trim(implode(' ', array_filter([
                    $order->contact?->first_name,
                    $order->contact?->last_name,
                ])));

                return [
                    'name' => $name !== '' ? $name : $order->code,
                    'status' => $order->status,
                    'code' => $order->code,
                    'href' => '/bookings/'.$order->code,
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @return list<array{name: string, code: string, href: string}>
     */
    protected function leadsMatching(string $query): array
    {
        $name = trim(str_replace(['%', '_'], '', $query));

        if ($name === '') {
            return [];
        }

        return Lead::query()
            ->active()
            ->with('contact:id,first_name,last_name')
            ->whereHas('contact', function ($contact) use ($name): void {
                $contact->where('first_name', 'like', '%'.$name.'%')
                    ->orWhere('last_name', 'like', '%'.$name.'%');
            })
            ->orderByDesc('id')
            ->limit(8)
            ->get()
            ->map(function (Lead $lead): array {
                $label = trim(implode(' ', array_filter([
                    $lead->contact?->first_name,
                    $lead->contact?->last_name,
                ])));

                return [
                    'name' => $label !== '' ? $label : $lead->code,
                    'code' => $lead->code,
                    'href' => '/leads?lead='.$lead->code,
                ];
            })
            ->values()
            ->all();
    }
}
