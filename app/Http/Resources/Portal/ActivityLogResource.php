<?php

namespace App\Http\Resources\Portal;

use App\Models\LogActivity;
use App\Support\ActivityCatalog;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;

/**
 * @mixin LogActivity
 */
class ActivityLogResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $subject = $this->relationLoaded('logable') ? $this->logable : null;

        return [
            'id' => $this->id,
            'action' => $this->action,
            'section' => ActivityCatalog::idFor($this->logable_type),
            'section_label' => ActivityCatalog::labelFor($this->logable_type),
            'subject' => [
                'type' => class_basename($this->logable_type),
                'id' => $this->logable_id,
                'label' => $subject && method_exists($subject, 'activitySubject')
                    ? $subject->activitySubject()
                    : $this->fallbackLabel(),
            ],
            'user' => $this->relationLoaded('user') && $this->user ? [
                'id' => $this->user->id,
                'display_name' => $this->user->display_name,
            ] : null,
            'details' => $this->details(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }

    private function fallbackLabel(): string
    {
        $attributes = array_merge($this->previous ?? [], $this->changes ?? []);
        $candidates = [
            $attributes['display_name'] ?? null,
            $attributes['title'] ?? null,
            $attributes['name'] ?? null,
            trim((string) ($attributes['first_name'] ?? '').' '.(string) ($attributes['last_name'] ?? '')),
            $attributes['code'] ?? null,
            $attributes['label'] ?? null,
            $attributes['action'] ?? null,
        ];

        foreach ($candidates as $value) {
            if (is_string($value) && trim($value) !== '' && $value !== 'Updated') {
                return trim($value);
            }
        }

        return class_basename($this->logable_type).' #'.$this->logable_id;
    }

    /**
     * @return list<array{field: string, from: string|null, to: string|null}>
     */
    private function details(): array
    {
        $changes = $this->changes ?? [];
        $previous = $this->previous ?? [];
        $keys = array_values(array_unique([...array_keys($changes), ...array_keys($previous)]));
        $rows = [];

        foreach ($keys as $key) {
            if (in_array($key, ['id', 'created_at', 'updated_at'], true)) {
                continue;
            }

            $from = array_key_exists($key, $previous) ? $this->display($previous[$key]) : null;
            $to = array_key_exists($key, $changes) ? $this->display($changes[$key]) : null;

            if ($this->action === 'updated' && $from === $to) {
                continue;
            }

            if ($this->action === 'created') {
                $from = null;
            }

            if ($this->action === 'deleted') {
                $to = null;
            }

            if ($from === null && $to === null) {
                continue;
            }

            $rows[] = [
                'field' => Str::headline(str_replace('_', ' ', (string) $key)),
                'from' => $from,
                'to' => $to,
            ];
        }

        return $rows;
    }

    private function display(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return 'Empty';
        }

        if (is_bool($value)) {
            return $value ? 'Yes' : 'No';
        }

        if (is_array($value)) {
            return 'Updated';
        }

        return (string) $value;
    }
}
