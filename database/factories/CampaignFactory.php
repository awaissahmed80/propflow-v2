<?php

namespace Database\Factories;

use App\Models\Campaign;
use App\Models\CampaignForm;
use App\Models\Project;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Campaign>
 */
class CampaignFactory extends Factory
{
    protected $model = Campaign::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $title = fake()->sentence(3);

        return [
            'public_id' => (string) Str::uuid(),
            'slug' => Str::slug($title).'-'.Str::lower(Str::random(4)),
            'title' => $title,
            'description' => fake()->optional()->paragraph(),
            'purpose' => Campaign::PURPOSE_LEAD_GENERATION,
            'source_type' => Campaign::SOURCE_CUSTOM_FORM,
            'channel' => Campaign::CHANNEL_WEBSITE,
            'owner_id' => null,
            'budget' => null,
            'target_cpl' => null,
            'tags' => [],
            'utm' => Campaign::defaultUtm(),
            'default_assignee_id' => null,
            'default_lead_stage_id' => null,
            'status' => Campaign::STATUS_DRAFT,
            'project_id' => null,
            'campaign_form_id' => null,
            'landing' => [
                'headline' => $title,
                'subheadline' => fake()->sentence(),
                'body' => fake()->paragraph(),
                'highlights' => [
                    fake()->words(3, true),
                    fake()->words(3, true),
                ],
                'cta_label' => 'Register interest',
                'thank_you_message' => 'Thanks — we will be in touch shortly.',
                'redirect_url' => null,
                'hero_image' => null,
            ],
            'goals' => Campaign::defaultGoals(),
            'starts_at' => null,
            'ends_at' => null,
        ];
    }

    public function active(): static
    {
        return $this->state(fn (): array => [
            'status' => Campaign::STATUS_ACTIVE,
        ]);
    }

    public function withProject(?Project $project = null): static
    {
        return $this->state(fn (): array => [
            'project_id' => $project?->id ?? Project::factory(),
        ]);
    }

    public function withForm(?CampaignForm $form = null): static
    {
        return $this->state(fn (): array => [
            'campaign_form_id' => $form?->id ?? CampaignForm::factory(),
        ]);
    }
}
