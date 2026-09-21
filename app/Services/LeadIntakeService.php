<?php

namespace App\Services;

use App\Models\Campaign;
use App\Models\CampaignForm;
use App\Models\CampaignFormSubmission;
use App\Models\Contact;
use App\Models\Lead;
use App\Models\LeadStage;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class LeadIntakeService
{
    /**
     * @param  array{
     *     first_name?: string|null,
     *     last_name?: string|null,
     *     phone_number?: string|null,
     *     email_address?: string|null,
     *     budget?: float|int|string|null,
     *     notes?: string|null,
     *     preferred_contact_time?: string|null,
     * }  $payload
     * @param  array{
     *     channel?: string,
     *     page_url?: string|null,
     *     referrer?: string|null,
     *     utm?: array<string, string>,
     *     user_agent?: string|null,
     *     ip?: string|null,
     * }  $meta
     * @return array{lead: Lead, contact: Contact, submission: CampaignFormSubmission, contact_reused: bool}
     */
    public function submitForm(
        CampaignForm $form,
        array $payload,
        ?Campaign $campaign = null,
        array $meta = [],
    ): array {
        return DB::connection('tenant')->transaction(function () use ($form, $payload, $campaign, $meta): array {
            [$contact, $contactReused] = $this->resolveContact([
                'first_name' => $payload['first_name'] ?? null,
                'last_name' => $payload['last_name'] ?? null,
                'phone_number' => $payload['phone_number'] ?? null,
                'email_address' => $payload['email_address'] ?? null,
            ]);

            $settings = array_merge(CampaignForm::defaultSettings(), $form->settings ?? []);
            $channel = $meta['channel'] ?? 'embed';

            $projectId = $campaign?->project_id
                ?? ($settings['project_id'] ?? null);

            $stageId = $settings['lead_stage_id']
                ?? LeadStage::defaultStageId();

            $source = $channel === 'landing'
                ? ($settings['landing_source'] ?? 'Campaign landing')
                : ($settings['source'] ?? 'Website form');

            $notesParts = [
                filled($payload['notes'] ?? null) ? (string) $payload['notes'] : null,
                filled($payload['preferred_contact_time'] ?? null)
                    ? 'Preferred contact time: '.$payload['preferred_contact_time']
                    : null,
            ];

            $knownKeys = [
                'first_name',
                'last_name',
                'phone_number',
                'email_address',
                'budget',
                'notes',
                'preferred_contact_time',
                'campaign_public_id',
                'channel',
                'page_url',
                'referrer',
                'utm',
                'company_website',
            ];

            foreach ($form->enabledFields() as $field) {
                $key = $field['key'] ?? null;

                if (! is_string($key) || $key === '' || in_array($key, $knownKeys, true)) {
                    continue;
                }

                $value = $payload[$key] ?? null;

                if (blank($value)) {
                    continue;
                }

                $label = $field['label'] ?? Str::title(str_replace('_', ' ', $key));
                $notesParts[] = $label.': '.$value;
            }

            $notes = trim(implode("\n", array_filter($notesParts)));

            $lead = Lead::query()->create([
                'contact_id' => $contact->id,
                'campaign_id' => $campaign?->id,
                'project_id' => $projectId ? (int) $projectId : null,
                'assigned_to' => $settings['assigned_to'] ?? null,
                'lead_stage_id' => $stageId ? (int) $stageId : null,
                'source' => $source,
                'tag' => Lead::TAG_MODERATE,
                'budget' => isset($payload['budget']) && $payload['budget'] !== ''
                    ? $payload['budget']
                    : 0,
                'notes' => $notes !== '' ? $notes : null,
            ]);

            $submission = CampaignFormSubmission::query()->create([
                'campaign_form_id' => $form->id,
                'campaign_id' => $campaign?->id,
                'lead_id' => $lead->id,
                'contact_id' => $contact->id,
                'payload' => $payload,
                'meta' => $meta,
            ]);

            return [
                'lead' => $lead,
                'contact' => $contact,
                'submission' => $submission,
                'contact_reused' => $contactReused,
            ];
        });
    }

    /**
     * @param  array{
     *     first_name?: string|null,
     *     last_name?: string|null,
     *     phone_number?: string|null,
     *     email_address?: string|null,
     *     reference?: string|null,
     *     contact_id?: int|null,
     * }  $data
     * @return array{0: Contact, 1: bool}
     */
    public function resolveContact(array $data, ?Lead $lead = null): array
    {
        $firstName = $data['first_name'] ?? null;
        $lastName = $data['last_name'] ?? null;
        $phone = filled($data['phone_number'] ?? null)
            ? trim((string) $data['phone_number'])
            : null;
        $email = filled($data['email_address'] ?? null)
            ? trim((string) $data['email_address'])
            : null;
        $company = filled($data['reference'] ?? null)
            ? trim((string) $data['reference'])
            : null;

        if (! empty($data['contact_id'])) {
            $contact = Contact::query()->findOrFail($data['contact_id']);
            $this->fillContactDetails($contact, $firstName, $lastName, $phone, $email, $company);

            return [$contact, false];
        }

        if ($lead?->contact) {
            $this->fillContactDetails(
                $lead->contact,
                $firstName,
                $lastName,
                $phone,
                $email,
                $company,
            );

            return [$lead->contact, false];
        }

        $existing = $this->findExistingContact($phone, $email);

        if ($existing) {
            $this->fillContactDetails($existing, $firstName, $lastName, $phone, $email, $company);

            return [$existing, true];
        }

        $contact = Contact::query()->create([
            'first_name' => $firstName,
            'last_name' => $lastName,
            'phone_number' => $phone,
            'email_address' => $email,
            'reference' => $company,
            'type' => 'LEAD',
            'tag' => 'GENERAL',
        ]);

        return [$contact, false];
    }

    protected function fillContactDetails(
        Contact $contact,
        ?string $firstName,
        ?string $lastName,
        ?string $phone,
        ?string $email,
        ?string $company,
    ): void {
        $contact->fill([
            'first_name' => $firstName ?: $contact->first_name,
            'last_name' => $lastName ?: $contact->last_name,
            'phone_number' => $phone ?: $contact->phone_number,
            'email_address' => $email ?: $contact->email_address,
            'reference' => $company ?: $contact->reference,
        ])->save();
    }

    protected function findExistingContact(?string $phone, ?string $email): ?Contact
    {
        if (filled($email)) {
            $byEmail = Contact::query()
                ->whereRaw('LOWER(email_address) = ?', [mb_strtolower($email)])
                ->first();

            if ($byEmail) {
                return $byEmail;
            }
        }

        if (! filled($phone)) {
            return null;
        }

        $digits = preg_replace('/\D+/', '', $phone) ?: '';

        if ($digits === '') {
            return null;
        }

        $exact = Contact::query()->where('phone_number', $phone)->first();

        if ($exact) {
            return $exact;
        }

        $suffix = substr($digits, -10);

        return Contact::query()
            ->whereNotNull('phone_number')
            ->where('phone_number', '!=', '')
            ->when(
                $suffix !== '',
                fn ($query) => $query->where('phone_number', 'like', '%'.$suffix.'%'),
            )
            ->orderByDesc('id')
            ->limit(50)
            ->get()
            ->first(function (Contact $contact) use ($digits, $suffix): bool {
                $existingDigits = preg_replace('/\D+/', '', (string) $contact->phone_number) ?: '';

                if ($existingDigits === $digits) {
                    return true;
                }

                if ($suffix === '' || strlen($existingDigits) < 10) {
                    return false;
                }

                return str_ends_with($existingDigits, $suffix);
            });
    }
}
