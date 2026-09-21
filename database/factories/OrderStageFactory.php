<?php

namespace Database\Factories;

use App\Models\Order;
use App\Models\OrderStage;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<OrderStage>
 */
class OrderStageFactory extends Factory
{
    protected $model = OrderStage::class;

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
            'is_system' => false,
            'is_enabled' => true,
        ];
    }

    public function booking(): static
    {
        return $this->state(fn (): array => [
            'label' => Order::STAGE_BOOKING,
            'title' => 'Booking & KYC',
            'priority' => 1,
            'color' => '#3B82F6',
            'is_system' => true,
            'is_enabled' => true,
        ]);
    }

    public function system(): static
    {
        return $this->state(fn (): array => [
            'is_system' => true,
            'is_enabled' => true,
        ]);
    }
}
