<?php

namespace Database\Factories;

use App\Models\Project;
use App\Models\ProjectProgress;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ProjectProgress>
 */
class ProjectProgressFactory extends Factory
{
    protected $model = ProjectProgress::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $start = fake()->optional(0.8)->dateTimeBetween('-1 year', '+3 months');
        $end = $start
            ? fake()->optional(0.7)->dateTimeBetween($start, '+6 months')
            : null;

        return [
            'project_id' => Project::factory(),
            'title' => fake()->words(3, true),
            'description' => fake()->optional()->sentence(),
            'status' => fake()->randomElement(['planned', 'in_progress', 'completed', 'delayed']),
            'progress' => fake()->numberBetween(0, 100),
            'order' => fake()->numberBetween(1, 10),
            'start_date' => $start,
            'end_date' => $end,
        ];
    }

    public function completed(): static
    {
        return $this->state(fn (): array => [
            'status' => 'completed',
            'progress' => 100,
        ]);
    }

    public function forProject(Project $project): static
    {
        return $this->state(fn (): array => [
            'project_id' => $project->id,
        ]);
    }
}
