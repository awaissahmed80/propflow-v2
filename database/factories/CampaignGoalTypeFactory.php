<?php

namespace Database\Factories;

use App\Models\CampaignGoalType;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<CampaignGoalType>
 */
class CampaignGoalTypeFactory extends Factory
{
    protected $model = CampaignGoalType::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $title = fake()->unique()->words(2, true);

        return [
            'label' => Str::slug($title, '_'),
            'title' => ucwords($title),
            'priority' => fake()->numberBetween(1, 20),
            'color' => fake()->hexColor(),
        ];
    }
}
