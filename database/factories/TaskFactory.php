<?php

namespace Database\Factories;

use App\Models\Lead;
use App\Models\Task;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Task>
 */
class TaskFactory extends Factory
{
    protected $model = Task::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => null,
            'lead_id' => Lead::factory(),
            'action' => fake()->randomElement(Task::activityTypes()),
            'comments' => fake()->sentence(),
            'status' => Task::STATUS_COMPLETED,
            'type' => Task::TYPE_ACTION,
        ];
    }

    public function systemLog(): static
    {
        return $this->state(fn (): array => [
            'action' => 'Lead created',
            'comments' => 'Created automatically.',
            'type' => Task::TYPE_LOG,
            'status' => Task::STATUS_COMPLETED,
        ]);
    }

    public function pending(): static
    {
        return $this->state(fn (): array => [
            'action' => 'Follow-up',
            'comments' => null,
            'type' => Task::TYPE_ACTION,
            'status' => Task::STATUS_PENDING,
        ]);
    }
}
