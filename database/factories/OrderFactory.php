<?php

namespace Database\Factories;

use App\Models\Contact;
use App\Models\Lead;
use App\Models\Order;
use App\Models\Project;
use App\Models\Unit;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Order>
 */
class OrderFactory extends Factory
{
    protected $model = Order::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'lead_id' => Lead::factory(),
            'contact_id' => Contact::factory(),
            'project_id' => Project::factory(),
            'unit_id' => Unit::factory(),
            'assigned_to' => null,
            'booking_kind' => Order::KIND_TOKEN,
            'agreed_price' => 1000000,
            'status' => Order::STATUS_BOOKED,
            'booked_at' => now(),
            'allocated_at' => null,
            'cancelled_at' => null,
        ];
    }

    public function booked(): static
    {
        return $this->state(fn (): array => [
            'status' => Order::STATUS_BOOKED,
            'booked_at' => now(),
            'allocated_at' => null,
            'cancelled_at' => null,
        ]);
    }

    public function allocated(): static
    {
        return $this->state(fn (): array => [
            'status' => Order::STATUS_ALLOCATED,
            'allocated_at' => now(),
        ]);
    }
}
