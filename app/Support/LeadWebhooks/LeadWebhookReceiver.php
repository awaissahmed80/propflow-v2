<?php

namespace App\Support\LeadWebhooks;

use App\Models\Campaign;
use App\Models\Lead;
use App\Models\LeadStage;
use App\Models\LeadWebhook;
use App\Models\LeadWebhookDelivery;
use App\Services\LeadIntakeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Illuminate\Validation\Validator;
use Throwable;

class LeadWebhookReceiver
{
    public function __construct(protected LeadIntakeService $intake) {}

    public function handle(Request $request): JsonResponse
    {
        $webhook = LeadWebhook::current();

        if (! $webhook?->acceptsSignatures()) {
            abort(404);
        }

        if (! $this->signatureIsValid($request, (string) $webhook->signing_secret)) {
            LeadWebhookDelivery::record(
                LeadWebhookDelivery::STATUS_REJECTED,
                401,
                'The signature is invalid.',
            );

            return response()->json([
                'message' => 'The signature is invalid.',
            ], 401);
        }

        try {
            $lead = $this->createLead($request->all(), $webhook);
        } catch (ValidationException $exception) {
            LeadWebhookDelivery::record(
                LeadWebhookDelivery::STATUS_REJECTED,
                422,
                $exception->validator->errors()->first() ?: 'The payload is invalid.',
            );

            throw $exception;
        } catch (Throwable $exception) {
            report($exception);

            LeadWebhookDelivery::record(
                LeadWebhookDelivery::STATUS_REJECTED,
                500,
                'The lead could not be created.',
            );

            return response()->json([
                'message' => 'The lead could not be created.',
            ], 500);
        }

        LeadWebhookDelivery::record(
            LeadWebhookDelivery::STATUS_ACCEPTED,
            201,
            null,
            $lead->id,
        );

        return response()->json([
            'lead' => [
                'code' => $lead->code,
            ],
        ], 201);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    protected function createLead(array $payload, LeadWebhook $webhook): Lead
    {
        foreach (['first_name', 'last_name', 'phone_number', 'email_address', 'notes', 'campaign_code', 'source'] as $key) {
            if (array_key_exists($key, $payload) && blank($payload[$key])) {
                $payload[$key] = null;
            }
        }

        $validated = validator($payload, [
            'first_name' => ['nullable', 'string', 'max:150'],
            'last_name' => ['nullable', 'string', 'max:150'],
            'phone_number' => ['nullable', 'string', 'max:50'],
            'email_address' => ['nullable', 'email', 'max:150'],
            'budget' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'campaign_code' => ['nullable', 'uuid'],
            'source' => ['nullable', 'string', 'max:150'],
        ])->after(function (Validator $validator) use ($payload): void {
            if (blank($payload['phone_number'] ?? null) && blank($payload['email_address'] ?? null)) {
                $validator->errors()->add('phone_number', 'A phone number or email address is required.');
            }
        })->validate();

        $campaign = $this->campaign($validated, $webhook);

        return DB::connection('tenant')->transaction(function () use ($validated, $webhook, $campaign): Lead {
            [$contact] = $this->intake->resolveContact([
                'first_name' => $validated['first_name'] ?? null,
                'last_name' => $validated['last_name'] ?? null,
                'phone_number' => $validated['phone_number'] ?? null,
                'email_address' => $validated['email_address'] ?? null,
            ]);

            $stageId = $campaign?->default_lead_stage_id
                ?? $webhook->default_lead_stage_id
                ?? LeadStage::query()->where('label', 'new')->value('id')
                ?? LeadStage::query()->orderBy('priority')->value('id');

            $source = filled($validated['source'] ?? null)
                ? trim((string) $validated['source'])
                : ($webhook->default_source ?: 'Webhook');

            return Lead::query()->create([
                'contact_id' => $contact->id,
                'campaign_id' => $campaign?->id,
                'project_id' => $campaign?->project_id,
                'assigned_to' => $campaign?->default_assignee_id ?? $webhook->default_assignee_id,
                'lead_stage_id' => $stageId ? (int) $stageId : null,
                'source' => $source,
                'tag' => Lead::TAG_MODERATE,
                'budget' => isset($validated['budget']) && $validated['budget'] !== ''
                    ? $validated['budget']
                    : 0,
                'notes' => filled($validated['notes'] ?? null) ? $validated['notes'] : null,
                'attributes' => [
                    'webhook' => [
                        'campaign_code' => $validated['campaign_code'] ?? null,
                    ],
                ],
            ]);
        });
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    protected function campaign(array $validated, LeadWebhook $webhook): ?Campaign
    {
        $code = $validated['campaign_code'] ?? null;

        if (filled($code)) {
            $campaign = Campaign::query()
                ->where('public_id', $code)
                ->where('status', Campaign::STATUS_ACTIVE)
                ->first();

            if (! $campaign) {
                throw ValidationException::withMessages([
                    'campaign_code' => 'The campaign code does not match an active campaign.',
                ]);
            }

            return $campaign;
        }

        if ($webhook->default_campaign_id === null) {
            return null;
        }

        return Campaign::query()
            ->whereKey($webhook->default_campaign_id)
            ->where('status', Campaign::STATUS_ACTIVE)
            ->first();
    }

    protected function signatureIsValid(Request $request, string $secret): bool
    {
        $header = $request->header(LeadWebhook::SIGNATURE_HEADER);
        $expected = LeadWebhook::sign($request->getContent(), $secret);

        if (! is_string($header) || strlen($header) !== strlen($expected)) {
            return false;
        }

        return hash_equals($expected, $header);
    }
}
