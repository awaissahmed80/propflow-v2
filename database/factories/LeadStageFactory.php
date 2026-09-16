<?php

namespace Database\Factories;

use App\Models\LeadStage;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<LeadStage>
 */
class LeadStageFactory extends Factory
{
    protected $model = LeadStage::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $label = fake()->unique()->slug(2);

        return [
            'label' => $label,
            'title' => fake()->words(2, true),
            'priority' => fake()->numberBetween(1, 20),
            'color' => fake()->hexColor(),
        ];
    }

    public function newLead(): static
    {
        return $this->state(fn (): array => [
            'label' => 'new',
            'title' => 'New',
            'priority' => 1,
            'color' => '#3B82F6',
        ]);
    }
}
