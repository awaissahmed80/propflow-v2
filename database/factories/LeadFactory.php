<?php

namespace Database\Factories;

use App\Models\Contact;
use App\Models\Lead;
use App\Models\LeadStage;
use App\Models\Project;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Lead>
 */
class LeadFactory extends Factory
{
    protected $model = Lead::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'contact_id' => Contact::factory(),
            'user_id' => null,
            'project_id' => Project::factory(),
            'unit_id' => null,
            'campaign_id' => null,
            'assigned_to' => null,
            'source' => fake()->randomElement(['Website', 'Referral', 'Walk-in', 'Facebook', 'Call']),
            'score' => fake()->numberBetween(0, 100),
            'next_action' => fake()->randomElement(Lead::nextActions()),
            'due_date' => fake()->optional()->dateTimeBetween('now', '+30 days'),
            'lead_stage_id' => LeadStage::factory()->newLead(),
            'tag' => Lead::TAG_MODERATE,
            'budget' => fake()->randomFloat(2, 500000, 15000000),
            'notes' => fake()->optional()->paragraph(),
            'group' => null,
            'attributes' => null,
            'contacted_at' => null,
        ];
    }

    public function forProject(Project $project): static
    {
        return $this->state(fn (): array => [
            'project_id' => $project->id,
        ]);
    }

    public function hot(): static
    {
        return $this->state(fn (): array => [
            'tag' => Lead::TAG_HOT,
        ]);
    }

    public function archived(): static
    {
        return $this->state(fn (): array => [
            'archived_at' => now(),
        ]);
    }
}
