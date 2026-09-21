<?php

namespace Database\Factories;

use App\Models\Order;
use App\Models\OrderStatus;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<OrderStatus>
 */
class OrderStatusFactory extends Factory
{
    protected $model = OrderStatus::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'stage_label' => Order::STAGE_ACTIVE,
            'label' => fake()->unique()->slug(2),
            'title' => fake()->words(2, true),
            'priority' => fake()->numberBetween(1, 20),
            'color' => fake()->hexColor(),
            'is_system' => true,
            'is_enabled' => true,
        ];
    }

    public function hold(): static
    {
        return $this->state(fn (): array => [
            'stage_label' => Order::STAGE_TOKEN,
            'label' => Order::STATUS_HOLD,
            'title' => 'Hold',
            'priority' => 1,
            'color' => '#94A3B8',
            'is_system' => true,
            'is_enabled' => true,
        ]);
    }
}
