<?php

namespace Database\Factories;

use App\Enums\TenantInvitationStatus;
use App\Models\Tenant;
use App\Models\TenantInvitation;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<TenantInvitation>
 */
class TenantInvitationFactory extends Factory
{
    protected $model = TenantInvitation::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'tenant_id' => Tenant::factory(),
            'invited_by' => User::factory()->tenant(),
            'email' => fake()->unique()->safeEmail(),
            'token' => Str::random(64),
            'first_name' => null,
            'last_name' => null,
            'phone_number' => null,
            'title' => 'Sales Executive',
            'department' => 'Sales',
            'manager_id' => null,
            'roles' => ['Sales Executive'],
            'status' => TenantInvitationStatus::Pending,
            'accepted_at' => null,
            'expires_at' => now()->addDays(7),
        ];
    }

    public function accepted(): static
    {
        return $this->state(fn (): array => [
            'status' => TenantInvitationStatus::Accepted,
            'accepted_at' => now(),
        ]);
    }

    public function expired(): static
    {
        return $this->state(fn (): array => [
            'status' => TenantInvitationStatus::Pending,
            'expires_at' => now()->subDay(),
        ]);
    }
}
