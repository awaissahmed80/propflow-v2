<?php

namespace Database\Factories;

use App\Models\LeadWebhookDelivery;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<LeadWebhookDelivery>
 */
class LeadWebhookDeliveryFactory extends Factory
{
    protected $model = LeadWebhookDelivery::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'status' => LeadWebhookDelivery::STATUS_ACCEPTED,
            'http_status' => 201,
            'message' => null,
            'lead_id' => null,
        ];
    }
}
