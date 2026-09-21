<?php

namespace Database\Factories;

use App\Models\LeadWebhook;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<LeadWebhook>
 */
class LeadWebhookFactory extends Factory
{
    protected $model = LeadWebhook::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'enabled' => false,
            'signing_secret' => LeadWebhook::generateSecret(),
            'default_source' => null,
            'default_campaign_id' => null,
            'default_lead_stage_id' => null,
            'default_assignee_id' => null,
        ];
    }

    public function enabled(): static
    {
        return $this->state(fn (): array => [
            'enabled' => true,
        ]);
    }
}
