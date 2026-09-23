<?php

namespace App\Mail;

use App\Models\Tenant;
use App\Models\User;
use App\Support\Domain;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class WorkspaceAddedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Tenant $tenant,
        public ?User $inviter = null,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "You've been added to {$this->tenant->name} on Propflow",
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'mail.workspace-added',
            with: [
                'workspace' => $this->tenant->name,
                'inviterName' => $this->inviter?->display_name ?? 'A teammate',
                'loginUrl' => Domain::auth(),
                'portalUrl' => Domain::portal(),
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
