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
        $notifications = $this->forTenant($request)
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
     * @return array{id: string, title: string, body: string, href: ?string, event: ?string, read_at: ?string, created_at: ?string}
     */
    protected function present(DatabaseNotification $notification): array
    {
        $data = is_array($notification->data) ? $notification->data : [];

        return [
            'id' => $notification->id,
            'title' => (string) ($data['title'] ?? 'Notification'),
            'body' => (string) ($data['body'] ?? ''),
            'href' => $data['href'] ?? null,
            'event' => $data['event'] ?? null,
            'read_at' => $notification->read_at?->toIso8601String(),
            'created_at' => $notification->created_at?->toIso8601String(),
        ];
    }
}
