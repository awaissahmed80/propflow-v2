<?php

namespace Database\Factories;

use App\Models\LeadActionType;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<LeadActionType>
 */
class LeadActionTypeFactory extends Factory
{
    protected $model = LeadActionType::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $title = fake()->unique()->words(2, true);

        return [
            'kind' => LeadActionType::KIND_ACTIVITY,
            'label' => Str::slug($title, '_'),
            'title' => ucwords($title),
            'priority' => fake()->numberBetween(1, 20),
            'icon' => null,
            'color' => LeadActionType::DEFAULT_COLOR,
            'is_system' => false,
            'is_enabled' => true,
        ];
    }

    public function activity(): static
    {
        return $this->state(fn (): array => [
            'kind' => LeadActionType::KIND_ACTIVITY,
        ]);
    }

    public function nextAction(): static
    {
        return $this->state(fn (): array => [
            'kind' => LeadActionType::KIND_NEXT_ACTION,
        ]);
    }

    public function system(): static
    {
        return $this->state(fn (): array => [
            'is_system' => true,
            'is_enabled' => true,
            'label' => LeadActionType::LABEL_DO_NOTHING,
            'title' => 'Do Nothing',
            'kind' => LeadActionType::KIND_NEXT_ACTION,
        ]);
    }
}
