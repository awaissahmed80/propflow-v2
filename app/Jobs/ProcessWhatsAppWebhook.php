<?php

namespace App\Jobs;

use App\Models\Integration;
use App\Models\Tenant;
use App\Support\Integrations\WhatsApp\WhatsAppWebhookProcessor;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Throwable;

class ProcessWhatsAppWebhook implements ShouldQueue
{
    use Queueable;

    /**
     * @param  array<string, mixed>  $payload
     */
    public function __construct(
        public string $tenantIdentifier,
        public array $payload,
    ) {}

    public function handle(WhatsAppWebhookProcessor $processor): void
    {
        $tenant = Tenant::query()->where('identifier', $this->tenantIdentifier)->first();

        if (! $tenant) {
            Log::warning('WhatsApp webhook job skipped — tenant missing', [
                'tenant' => $this->tenantIdentifier,
            ]);

            return;
        }

        $tenant->makeCurrent();

        try {
            $integration = Integration::query()
                ->where('provider', Integration::PROVIDER_WHATSAPP)
                ->where('status', Integration::STATUS_CONNECTED)
                ->first();

            if (! $integration) {
                Log::warning('WhatsApp webhook job skipped — integration not connected', [
                    'tenant' => $this->tenantIdentifier,
                ]);

                return;
            }

            $processor->handle($integration, $this->payload);
        } catch (Throwable $exception) {
            Log::error('WhatsApp webhook job failed', [
                'tenant' => $this->tenantIdentifier,
                'message' => $exception->getMessage(),
            ]);

            throw $exception;
        } finally {
            Tenant::forgetCurrent();
        }
    }
}
