<?php

namespace Database\Factories;

use App\Enums\TenantMembershipStatus;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TenantUser>
 */
class TenantUserFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'tenant_id' => Tenant::factory(),
            'title' => fake()->optional()->jobTitle(),
            'department' => fake()->optional()->word(),
            'status' => TenantMembershipStatus::Active,
            'is_owner' => false,
        ];
    }

    public function owner(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_owner' => true,
            'title' => 'Administrator',
        ]);
    }
}
