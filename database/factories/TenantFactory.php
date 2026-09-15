<?php

namespace Database\Factories;

use App\Enums\TenantStatus;
use App\Models\Tenant;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Tenant>
 */
class TenantFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $identifier = Str::lower(Str::random(8));

        return [
            'name' => fake()->company(),
            'identifier' => $identifier,
            'database' => 'tenant_'.$identifier,
            'status' => TenantStatus::Active,
        ];
    }
}
