<?php

namespace Database\Factories;

use App\Models\Project;
use App\Models\ProjectBlock;
use App\Models\Unit;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Unit>
 */
class UnitFactory extends Factory
{
    protected $model = Unit::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->optional()->bothify('Unit-###'),
            'description' => fake()->optional()->sentence(),
            'type' => fake()->randomElement(['Apartment', 'Plot', 'Shop', 'Villa']),
            'sector' => fake()->optional()->streetName(),
            'price' => fake()->randomFloat(2, 50000, 5000000),
            'size' => fake()->randomFloat(2, 500, 5000),
            'area_type' => fake()->randomElement(['Sq. Feet', 'Sq. Yards', 'Marla']),
            'quantity' => 1,
            'status' => Unit::STATUS_AVAILABLE,
            'project_id' => Project::factory(),
            'project_block_id' => null,
        ];
    }

    public function forBlock(ProjectBlock $block): static
    {
        return $this->state(fn (): array => [
            'project_id' => $block->project_id,
            'project_block_id' => $block->id,
        ]);
    }

    public function sold(): static
    {
        return $this->state(fn (): array => [
            'status' => Unit::STATUS_SOLD,
        ]);
    }

    public function reserved(): static
    {
        return $this->state(fn (): array => [
            'status' => Unit::STATUS_RESERVED,
        ]);
    }
}
