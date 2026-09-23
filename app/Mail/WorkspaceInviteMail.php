<?php

namespace App\Mail;

use App\Models\Tenant;
use App\Models\TenantInvitation;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class WorkspaceInviteMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public TenantInvitation $invitation,
        public Tenant $tenant,
        public ?User $inviter = null,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "You're invited to join {$this->tenant->name} on Propflow",
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'mail.workspace-invite',
            with: [
                'workspace' => $this->tenant->name,
                'inviterName' => $this->inviter?->display_name ?? 'A teammate',
                'acceptUrl' => $this->invitation->acceptUrl(),
                'expiresAt' => $this->invitation->expires_at,
            ],
        );
    }

    /**
     * @return array<int, Attachment>
     */
    public function attachments(): array
    {
        return [];
    }
}
