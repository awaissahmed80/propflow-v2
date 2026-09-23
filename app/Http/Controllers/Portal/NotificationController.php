<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $paginator = $this->forTenant($request)
            ->latest()
            ->paginate(20)
            ->withQueryString();

        return response()->json([
            'notifications' => $paginator->getCollection()
                ->map(fn (DatabaseNotification $notification): array => $this->present($notification))
                ->values()
                ->all(),
            'pagination' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
            'unread_count' => $this->forTenant($request)->whereNull('read_at')->count(),
        ]);
    }

    public function feed(Request $request): JsonResponse
    {
        $notifications = $this->forTenant($request)
            ->whereNull('read_at')
            ->latest()
            ->limit(30)
            ->get()
            ->map(fn (DatabaseNotification $notification): array => $this->present($notification))
            ->values();

        return response()->json([
            'notifications' => $notifications,
            'unread_count' => $this->forTenant($request)->whereNull('read_at')->count(),
        ]);
    }

    public function read(Request $request, string $notification): JsonResponse
    {
        $record = $this->forTenant($request)->whereKey($notification)->firstOrFail();
        $record->markAsRead();

        return response()->json([
            'notification' => $this->present($record->refresh()),
            'unread_count' => $this->forTenant($request)->whereNull('read_at')->count(),
        ]);
    }

    public function unread(Request $request, string $notification): JsonResponse
    {
        $record = $this->forTenant($request)->whereKey($notification)->firstOrFail();
        $record->forceFill(['read_at' => null])->save();

        return response()->json([
            'notification' => $this->present($record->refresh()),
            'unread_count' => $this->forTenant($request)->whereNull('read_at')->count(),
        ]);
    }

    public function destroy(Request $request, string $notification): JsonResponse
    {
        $record = $this->forTenant($request)->whereKey($notification)->firstOrFail();
        $record->delete();

        return response()->json([
            'unread_count' => $this->forTenant($request)->whereNull('read_at')->count(),
        ]);
    }

    public function readAll(Request $request): JsonResponse
    {
        $this->forTenant($request)->whereNull('read_at')->update(['read_at' => now()]);

        return response()->json([
            'unread_count' => 0,
        ]);
    }

    /**
     * @return MorphMany<DatabaseNotification, User>
     */
    protected function forTenant(Request $request): MorphMany
    {
        $tenantId = Tenant::current()?->id;

        return $request->user()
            ->notifications()
            ->where('data->tenant_id', $tenantId);
    }

    /**
     * @return array{id: string, title: string, body: string, href: ?string, event: ?string, icon: string, read_at: ?string, created_at: ?string}
     */
    protected function present(DatabaseNotification $notification): array
    {
        $data = is_array($notification->data) ? $notification->data : [];
        $event = isset($data['event']) ? (string) $data['event'] : null;

        return [
            'id' => $notification->id,
            'title' => (string) ($data['title'] ?? 'Notification'),
            'body' => (string) ($data['body'] ?? ''),
            'href' => $data['href'] ?? null,
            'event' => $event,
            'icon' => $this->iconForEvent($event),
            'read_at' => $notification->read_at?->toIso8601String(),
            'created_at' => $notification->created_at?->toIso8601String(),
        ];
    }

    protected function iconForEvent(?string $event): string
    {
        return match (true) {
            $event !== null && str_starts_with($event, 'lead_') => 'customer-service-line',
            $event !== null && str_starts_with($event, 'follow_up_') => 'calendar-schedule-line',
            $event !== null && str_starts_with($event, 'task_') => 'checkbox-circle-line',
            $event !== null && str_starts_with($event, 'personal_reminder_') => 'alarm-line',
            $event === 'installment_due', $event === 'installment_overdue' => 'money-dollar-circle-line',
            $event === 'handover_ready' => 'home-smile-2-line',
            default => 'notification-3-line',
        };
    }
}
