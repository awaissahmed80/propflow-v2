<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'campaign_form_id',
    'campaign_id',
    'lead_id',
    'contact_id',
    'payload',
    'meta',
])]
#[Connection('tenant')]
class CampaignFormSubmission extends Model
{
    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'campaign_form_id' => 'integer',
            'campaign_id' => 'integer',
            'lead_id' => 'integer',
            'contact_id' => 'integer',
            'payload' => 'array',
            'meta' => 'array',
        ];
    }

    /**
     * @return BelongsTo<CampaignForm, $this>
     */
    public function form(): BelongsTo
    {
        return $this->belongsTo(CampaignForm::class, 'campaign_form_id');
    }

    /**
     * @return BelongsTo<Campaign, $this>
     */
    public function campaign(): BelongsTo
    {
        return $this->belongsTo(Campaign::class);
    }

    /**
     * @return BelongsTo<Lead, $this>
     */
    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class);
    }

    /**
     * @return BelongsTo<Contact, $this>
     */
    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }
}
