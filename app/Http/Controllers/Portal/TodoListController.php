<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\StorePersonalReminderRequest;
use App\Http\Requests\Portal\UpdatePersonalReminderRequest;
use App\Models\PersonalReminder;
use App\Services\CriticalDueNotifier;
use App\Services\TodoFeed;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class TodoListController extends Controller
{
    public function __construct(
        protected TodoFeed $todoFeed,
        protected CriticalDueNotifier $criticalDueNotifier,
    ) {}

    public function index(Request $request): Response
    {
        $user = $request->user();
        $window = $request->string('window')->trim()->toString();
        $window = in_array($window, TodoFeed::windows(), true) ? $window : TodoFeed::WINDOW_WEEK;
        $page = max(1, (int) $request->integer('page', 1));

        $reminders = PersonalReminder::query()
            ->forUser((int) $user->id)
            ->orderByRaw('completed_at is null desc')
            ->orderByRaw('due_at is null asc')
            ->orderBy('due_at')
            ->orderByDesc('id')
            ->limit(100)
            ->get()
            ->map(fn (PersonalReminder $reminder): array => $this->reminderPayload($reminder))
            ->values()
            ->all();

        $feed = $this->todoFeed->forUser($user, $window, $page);

        return Inertia::render('todos/index', [
            'title' => 'Todo List',
            'description' => 'Critical follow-ups across leads and bookings, plus your own reminders.',
            'breadcrumbs' => [
                ['label' => 'Todo List'],
            ],
            'window' => $window,
            'windows' => [
                ['id' => TodoFeed::WINDOW_OVERDUE, 'label' => 'Overdue'],
                ['id' => TodoFeed::WINDOW_TODAY, 'label' => 'Today'],
                ['id' => TodoFeed::WINDOW_WEEK, 'label' => 'This week'],
                ['id' => TodoFeed::WINDOW_ALL, 'label' => 'All'],
            ],
            'feed' => $feed['items'],
            'feedPagination' => $feed['pagination'],
            'reminders' => $reminders,
        ]);
    }

    public function store(StorePersonalReminderRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        $reminder = PersonalReminder::query()->create([
            'user_id' => $request->user()->id,
            'title' => $validated['title'],
            'notes' => $validated['notes'] ?? null,
            'due_at' => $validated['due_at'] ?? null,
        ]);

        $this->criticalDueNotifier->notifyPersonalReminder($reminder);

        return to_route('portal.todos.index', $this->windowQuery($request));
    }

    public function update(UpdatePersonalReminderRequest $request, PersonalReminder $reminder): RedirectResponse
    {
        $this->authorizeReminder($request, $reminder);

        $validated = $request->validated();

        if (array_key_exists('title', $validated)) {
            $reminder->title = $validated['title'];
        }

        if (array_key_exists('notes', $validated)) {
            $reminder->notes = $validated['notes'];
        }

        if (array_key_exists('due_at', $validated)) {
            $reminder->due_at = $validated['due_at'];
        }

        if (array_key_exists('completed', $validated)) {
            $reminder->completed_at = $validated['completed'] ? ($reminder->completed_at ?? now()) : null;
        }

        $reminder->save();
        $this->criticalDueNotifier->notifyPersonalReminder($reminder);

        return to_route('portal.todos.index', $this->windowQuery($request));
    }

    public function destroy(Request $request, PersonalReminder $reminder): RedirectResponse
    {
        $this->authorizeReminder($request, $reminder);
        $reminder->forceDelete();

        return to_route('portal.todos.index', $this->windowQuery($request));
    }

    protected function authorizeReminder(Request $request, PersonalReminder $reminder): void
    {
        abort_unless((int) $reminder->user_id === (int) $request->user()->id, 403);
    }

    /**
     * @return array{window?: string}
     */
    protected function windowQuery(Request $request): array
    {
        $window = $request->string('window')->trim()->toString();

        if ($window === '' || $window === TodoFeed::WINDOW_WEEK) {
            return [];
        }

        return in_array($window, TodoFeed::windows(), true) ? ['window' => $window] : [];
    }

    /**
     * @return array{
     *     id: int,
     *     title: string,
     *     notes: ?string,
     *     due_at: ?string,
     *     completed_at: ?string,
     *     overdue: bool,
     *     completed: bool
     * }
     */
    protected function reminderPayload(PersonalReminder $reminder): array
    {
        return [
            'id' => $reminder->id,
            'title' => $reminder->title,
            'notes' => $reminder->notes,
            'due_at' => $reminder->due_at?->toIso8601String(),
            'completed_at' => $reminder->completed_at?->toIso8601String(),
            'overdue' => $reminder->isOverdue(),
            'completed' => $reminder->isCompleted(),
        ];
    }
}
