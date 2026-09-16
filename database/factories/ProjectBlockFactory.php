<?php

namespace Database\Factories;

use App\Models\Project;
use App\Models\ProjectBlock;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ProjectBlock>
 */
class ProjectBlockFactory extends Factory
{
    protected $model = ProjectBlock::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'project_id' => Project::factory(),
            'title' => fake()->randomElement(['Tower A', 'Tower B', 'Phase 1', 'Wing North']),
            'description' => fake()->optional()->sentence(),
        ];
    }
}
