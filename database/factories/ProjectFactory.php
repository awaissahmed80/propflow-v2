<?php

namespace Database\Factories;

use App\Models\Project;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Project>
 */
class ProjectFactory extends Factory
{
    protected $model = Project::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'title' => fake()->words(3, true),
            'description' => fake()->optional()->sentence(),
            'type' => fake()->randomElement(['residential', 'commercial', 'mixed']),
            'purpose' => fake()->optional()->randomElement(['sale', 'rent', 'both']),
            'country' => fake()->country(),
            'city' => fake()->city(),
            'location' => fake()->streetAddress(),
            'status' => fake()->randomElement(['draft', 'active', 'on_hold', 'completed']),
            'start_date' => fake()->optional()->date(),
            'end_date' => null,
            'progress' => fake()->numberBetween(0, 100),
        ];
    }

    public function active(): static
    {
        return $this->state(fn (): array => [
            'status' => 'active',
        ]);
    }
}
