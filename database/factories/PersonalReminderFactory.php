<?php

namespace Database\Factories;

use App\Models\PersonalReminder;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PersonalReminder>
 */
class PersonalReminderFactory extends Factory
{
    protected $model = PersonalReminder::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => fake()->numberBetween(1, 9999),
            'title' => fake()->sentence(3),
            'notes' => fake()->optional()->sentence(),
            'due_at' => fake()->optional()->dateTimeBetween('now', '+7 days'),
            'completed_at' => null,
        ];
    }

    public function forUser(int $userId): static
    {
        return $this->state(fn (): array => [
            'user_id' => $userId,
        ]);
    }

    public function completed(): static
    {
        return $this->state(fn (): array => [
            'completed_at' => now(),
        ]);
    }

    public function overdue(): static
    {
        return $this->state(fn (): array => [
            'due_at' => now()->subDay(),
            'completed_at' => null,
        ]);
    }
}
