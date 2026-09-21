<?php

namespace Database\Factories;

use App\Models\CustomField;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<CustomField>
 */
class CustomFieldFactory extends Factory
{
    protected $model = CustomField::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $label = fake()->unique()->words(2, true);

        return [
            'entity' => CustomField::ENTITY_CAMPAIGN_FORM,
            'key' => Str::slug($label, '_'),
            'label' => Str::title($label),
            'type' => fake()->randomElement(CustomField::fieldTypes()),
            'required' => false,
            'enabled' => true,
            'placeholder' => null,
            'priority' => fake()->numberBetween(1, 20),
            'is_system' => false,
        ];
    }

    public function system(): static
    {
        return $this->state(fn (): array => [
            'is_system' => true,
        ]);
    }
}
