<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Notification;

class WorkspaceNotification extends Notification
{
    use Queueable;

    /**
     * @param  array{tenant_id: int, event: string, title: string, body: string, href: ?string, reference?: ?string}  $payload
     */
    public function __construct(public array $payload) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['database', 'broadcast'];
    }

    /**
     * @return array{tenant_id: int, event: string, title: string, body: string, href: ?string, reference: ?string, created_at: string}
     */
    public function toArray(object $notifiable): array
    {
        return [
            'tenant_id' => (int) $this->payload['tenant_id'],
            'event' => $this->payload['event'],
            'title' => $this->payload['title'],
            'body' => $this->payload['body'],
            'href' => $this->payload['href'] ?? null,
            'reference' => $this->payload['reference'] ?? null,
            'created_at' => now()->toIso8601String(),
        ];
    }

    public function toBroadcast(object $notifiable): BroadcastMessage
    {
        // Push over Reverb immediately — do not wait on the app queue worker.
        return (new BroadcastMessage($this->toArray($notifiable)))
            ->onConnection('sync');
    }
}
