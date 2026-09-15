<?php

namespace Database\Factories;

use App\Enums\UserStatus;
use App\Enums\UserType;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    protected static ?string $password;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $firstName = fake()->firstName();
        $lastName = fake()->lastName();

        return [
            'type' => UserType::Tenant,
            'display_name' => $firstName.' '.$lastName,
            'first_name' => $firstName,
            'last_name' => $lastName,
            'email_address' => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'password' => static::$password ??= Hash::make('password'),
            'phone_number' => fake()->optional()->e164PhoneNumber(),
            'status' => UserStatus::Active,
            'remember_token' => Str::random(10),
        ];
    }

    public function platform(): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => UserType::Platform,
            'display_name' => 'Platform Admin',
        ]);
    }

    public function tenant(): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => UserType::Tenant,
        ]);
    }

    public function unverified(): static
    {
        return $this->state(fn (array $attributes) => [
            'email_verified_at' => null,
        ]);
    }
}
