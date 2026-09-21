<?php

namespace App\Observers;

use App\Models\Lead;
use App\Models\LeadStage;
use App\Support\Notifications\WorkspaceNotifier;

class LeadNotificationObserver
{
    public function created(Lead $lead): void
    {
        $name = $this->contactName($lead);

        WorkspaceNotifier::send(
            'lead_created',
            'New lead',
            $name.' was added'.(filled($lead->source) ? ' from '.$lead->source : '').'.',
            $this->leadHref($lead),
            WorkspaceNotifier::userOrMembers($lead->assigned_to),
        );
    }

    public function updated(Lead $lead): void
    {
        $name = $this->contactName($lead);

        if ($lead->wasChanged('assigned_to') && $lead->assigned_to !== null) {
            WorkspaceNotifier::send(
                'lead_assigned',
                'Lead assigned',
                $name.' was assigned to you.',
                $this->leadHref($lead),
                WorkspaceNotifier::userOrMembers($lead->assigned_to),
            );
        }

        if ($lead->wasChanged('lead_stage_id')) {
            $stage = LeadStage::query()->whereKey($lead->lead_stage_id)->value('title') ?: 'a new stage';

            WorkspaceNotifier::send(
                'lead_stage_changed',
                'Stage changed',
                $name.' moved to '.$stage.'.',
                $this->leadHref($lead),
                WorkspaceNotifier::userOrMembers($lead->assigned_to),
            );
        }
    }

    protected function contactName(Lead $lead): string
    {
        $lead->loadMissing('contact');

        return $lead->contact?->display_name ?: 'A lead';
    }

    protected function leadHref(Lead $lead): string
    {
        return filled($lead->code) ? '/leads#'.$lead->code : '/leads';
    }
}
