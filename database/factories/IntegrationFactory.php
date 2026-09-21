<?php

namespace Database\Factories;

use App\Models\Integration;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Integration>
 */
class IntegrationFactory extends Factory
{
    protected $model = Integration::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'provider' => Integration::PROVIDER_META,
            'status' => Integration::STATUS_INACTIVE,
            'external_id' => null,
            'external_name' => null,
            'access_token' => null,
            'refresh_token' => null,
            'webhook_verify_token' => Str::random(32),
            'settings' => [],
            'leads_synced_count' => 0,
            'last_synced_at' => null,
            'last_error' => null,
        ];
    }

    public function connected(): static
    {
        return $this->state(fn (): array => [
            'status' => Integration::STATUS_CONNECTED,
            'external_id' => (string) fake()->numerify('##########'),
            'external_name' => fake()->company().' Page',
            'access_token' => Str::random(64),
            'last_synced_at' => now()->subMinutes(2),
            'leads_synced_count' => fake()->numberBetween(10, 500),
            'last_error' => null,
        ]);
    }

    public function errored(): static
    {
        return $this->state(fn (): array => [
            'status' => Integration::STATUS_ERROR,
            'last_error' => 'Unable to fetch leadgen data from Meta.',
            'last_synced_at' => now()->subHours(3),
        ]);
    }
}
