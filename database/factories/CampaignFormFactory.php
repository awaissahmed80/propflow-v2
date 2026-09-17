<?php

namespace Database\Factories;

use App\Models\CampaignForm;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<CampaignForm>
 */
class CampaignFormFactory extends Factory
{
    protected $model = CampaignForm::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'public_id' => (string) Str::uuid(),
            'name' => fake()->words(2, true).' form',
            'status' => CampaignForm::STATUS_DRAFT,
            'fields' => CampaignForm::defaultFields(),
            'settings' => CampaignForm::defaultSettings(),
            'branding' => [
                'primary_color' => null,
                'button_label' => 'Submit',
            ],
        ];
    }

    public function active(): static
    {
        return $this->state(fn (): array => [
            'status' => CampaignForm::STATUS_ACTIVE,
        ]);
    }
}
