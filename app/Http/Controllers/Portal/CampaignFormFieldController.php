<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\ReorderCampaignFormFieldsRequest;
use App\Http\Requests\Portal\StoreCampaignFormFieldRequest;
use App\Http\Requests\Portal\UpdateCampaignFormFieldRequest;
use App\Models\CampaignForm;
use App\Models\CustomField;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CampaignFormFieldController extends Controller
{
    public function store(StoreCampaignFormFieldRequest $request): RedirectResponse
    {
        $validated = $request->validated();
        $maxPriority = (int) CustomField::query()
            ->where('entity', CustomField::ENTITY_CAMPAIGN_FORM)
            ->max('priority');

        $field = CustomField::query()->create([
            'entity' => CustomField::ENTITY_CAMPAIGN_FORM,
            'key' => $validated['key'] ?? Str::slug($validated['label'], '_'),
            'label' => $validated['label'],
            'type' => $validated['type'] ?? 'text',
            'required' => (bool) ($validated['required'] ?? false),
            'enabled' => (bool) ($validated['enabled'] ?? true),
            'placeholder' => $validated['placeholder'] ?? null,
            'priority' => $maxPriority + 1,
            'is_system' => false,
        ]);

        $this->appendFieldToCampaignForms($field);

        return back();
    }

    public function update(UpdateCampaignFormFieldRequest $request, CustomField $field): RedirectResponse
    {
        abort_unless($field->entity === CustomField::ENTITY_CAMPAIGN_FORM, 404);

        $validated = $request->validated();
        $previousKey = $field->key;

        $payload = [
            'label' => $validated['label'],
            'type' => $validated['type'] ?? $field->type,
            'required' => array_key_exists('required', $validated)
                ? (bool) $validated['required']
                : $field->required,
            'enabled' => array_key_exists('enabled', $validated)
                ? (bool) $validated['enabled']
                : $field->enabled,
            'placeholder' => array_key_exists('placeholder', $validated)
                ? $validated['placeholder']
                : $field->placeholder,
        ];

        if (! $field->is_system && filled($validated['key'] ?? null)) {
            $payload['key'] = $validated['key'];
        }

        $field->forceFill($payload)->save();

        $this->syncFieldAcrossCampaignForms($field, (string) $previousKey);

        return back();
    }

    public function reorder(ReorderCampaignFormFieldsRequest $request): RedirectResponse
    {
        $order = $request->validated('order');

        DB::connection('tenant')->transaction(function () use ($order): void {
            foreach ($order as $index => $fieldId) {
                CustomField::query()
                    ->where('entity', CustomField::ENTITY_CAMPAIGN_FORM)
                    ->whereKey($fieldId)
                    ->update(['priority' => $index + 1]);
            }
        });

        $this->reorderFieldsAcrossCampaignForms(
            CustomField::query()
                ->where('entity', CustomField::ENTITY_CAMPAIGN_FORM)
                ->orderBy('priority')
                ->pluck('key')
                ->all()
        );

        return back();
    }

    public function destroy(CustomField $field): RedirectResponse
    {
        abort_unless($field->entity === CustomField::ENTITY_CAMPAIGN_FORM, 404);

        if ($field->is_system) {
            return back()->withErrors([
                'field' => 'System fields cannot be deleted.',
            ]);
        }

        $key = $field->key;

        DB::connection('tenant')->transaction(function () use ($field, $key): void {
            $this->removeFieldAcrossCampaignForms((string) $key);
            $field->delete();

            $remaining = CustomField::query()
                ->where('entity', CustomField::ENTITY_CAMPAIGN_FORM)
                ->orderBy('priority')
                ->pluck('id');

            foreach ($remaining as $index => $id) {
                CustomField::query()->whereKey($id)->update(['priority' => $index + 1]);
            }
        });

        return back();
    }

    protected function appendFieldToCampaignForms(CustomField $field): void
    {
        $definition = $this->fieldDefinition($field);

        CampaignForm::query()
            ->orderBy('id')
            ->each(function (CampaignForm $form) use ($definition): void {
                $fields = $form->fields ?? [];

                foreach ($fields as $existing) {
                    if (($existing['key'] ?? null) === $definition['key']) {
                        return;
                    }
                }

                $fields[] = $definition;
                $form->forceFill(['fields' => array_values($fields)])->save();
            });
    }

    protected function syncFieldAcrossCampaignForms(CustomField $field, string $previousKey): void
    {
        $definition = $this->fieldDefinition($field);

        CampaignForm::query()
            ->orderBy('id')
            ->each(function (CampaignForm $form) use ($definition, $previousKey): void {
                $fields = $form->fields ?? [];
                $found = false;

                foreach ($fields as $index => $existing) {
                    if (($existing['key'] ?? null) !== $previousKey) {
                        continue;
                    }

                    $fields[$index] = [
                        ...$definition,
                        'enabled' => (bool) ($existing['enabled'] ?? $definition['enabled']),
                    ];
                    $found = true;
                    break;
                }

                if (! $found) {
                    $fields[] = $definition;
                }

                $form->forceFill(['fields' => array_values($fields)])->save();
            });
    }

    protected function removeFieldAcrossCampaignForms(string $key): void
    {
        CampaignForm::query()
            ->orderBy('id')
            ->each(function (CampaignForm $form) use ($key): void {
                $fields = collect($form->fields ?? [])
                    ->reject(fn (array $field): bool => ($field['key'] ?? null) === $key)
                    ->values()
                    ->all();

                $form->forceFill(['fields' => $fields])->save();
            });
    }

    /**
     * @param  list<string>  $orderedKeys
     */
    protected function reorderFieldsAcrossCampaignForms(array $orderedKeys): void
    {
        CampaignForm::query()
            ->orderBy('id')
            ->each(function (CampaignForm $form) use ($orderedKeys): void {
                $byKey = collect($form->fields ?? [])
                    ->filter(fn ($field): bool => is_array($field) && filled($field['key'] ?? null))
                    ->keyBy(fn (array $field): string => (string) $field['key']);

                $ordered = [];

                foreach ($orderedKeys as $key) {
                    if ($byKey->has($key)) {
                        $ordered[] = $byKey->get($key);
                        $byKey->forget($key);
                    }
                }

                foreach ($byKey as $remaining) {
                    $ordered[] = $remaining;
                }

                $form->forceFill(['fields' => $ordered])->save();
            });
    }

    /**
     * @return array{key: string, label: string, type: string, required: bool, enabled: bool, placeholder?: string}
     */
    protected function fieldDefinition(CustomField $field): array
    {
        $definition = [
            'key' => $field->key,
            'label' => $field->label,
            'type' => $field->type,
            'required' => (bool) $field->required,
            'enabled' => (bool) $field->enabled,
        ];

        if (filled($field->placeholder)) {
            $definition['placeholder'] = $field->placeholder;
        }

        return $definition;
    }
}
