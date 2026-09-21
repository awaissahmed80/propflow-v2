<?php

namespace Database\Factories;

use App\Models\PaymentPlanTemplate;
use App\Models\Project;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PaymentPlanTemplate>
 */
class PaymentPlanTemplateFactory extends Factory
{
    protected $model = PaymentPlanTemplate::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'title' => fake()->words(3, true).' plan',
            'project_id' => null,
            'frequency' => fake()->randomElement(['monthly', 'quarterly']),
            'installment_count' => fake()->randomElement([12, 24, 36, 48]),
            'balloon_every' => null,
            'down_payment_percent' => 10,
            'handover_percent' => 10,
            'late_fee_basis' => 'monthly',
            'late_fee_rate' => 1,
            'is_system' => false,
            'is_enabled' => true,
        ];
    }

    public function forProject(Project $project): static
    {
        return $this->state(fn (): array => [
            'project_id' => $project->id,
        ]);
    }

    public function disabled(): static
    {
        return $this->state(fn (): array => [
            'is_enabled' => false,
        ]);
    }
}
