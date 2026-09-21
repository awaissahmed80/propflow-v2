<?php

namespace App\Support\Assistant;

class AssistantInterpreter
{
    public const INTENT_WORK = 'work';

    public const INTENT_PROGRESS = 'progress';

    public const INTENT_REMINDERS = 'reminders';

    public const INTENT_CREATE_LEAD = 'create_lead';

    public const INTENT_UNKNOWN = 'unknown';

    public const UNKNOWN_PROMPT = 'I can show your work, your progress, your reminders, or start a lead.';

    /**
     * @param  list<array{id: int, code: string, title: string}>  $projects
     * @return array{
     *     intent: string,
     *     slots: array<string, mixed>,
     *     missing: list<string>,
     *     prompt: string
     * }
     */
    public function interpret(string $transcript, array $projects = []): array
    {
        $text = trim(preg_replace('/\s+/', ' ', $transcript) ?? '');
        $intent = $this->intent($text);

        if ($intent !== self::INTENT_CREATE_LEAD) {
            return [
                'intent' => $intent,
                'slots' => [],
                'missing' => [],
                'prompt' => $intent === self::INTENT_UNKNOWN
                    ? self::UNKNOWN_PROMPT
                    : $this->readyPrompt($intent),
            ];
        }

        $slots = $this->leadSlots($text, $projects);
        $missing = $this->missingLeadFields($slots);

        return [
            'intent' => $intent,
            'slots' => $slots,
            'missing' => $missing,
            'prompt' => $this->leadPrompt($missing),
        ];
    }

    protected function intent(string $text): string
    {
        if ($text === '') {
            return self::INTENT_UNKNOWN;
        }

        if (preg_match('/\b(?:new|create|add|start)\b(?:\s+\w+){0,4}\s+lead\b/i', $text) === 1
            || preg_match('/\blead\s+for\b/i', $text) === 1) {
            return self::INTENT_CREATE_LEAD;
        }

        if (preg_match('/\breminders?\b|\bnotifications?\b/i', $text) === 1) {
            return self::INTENT_REMINDERS;
        }

        if (preg_match('/\bmy progress\b|\bhow am i\b|\bprogress\b/i', $text) === 1) {
            return self::INTENT_PROGRESS;
        }

        if (preg_match('/\bwhat do i have\b|\bwhat should i\b|\bmy work\b|\btoday(?:\'s)? work\b|\boverdue\b|^\s*today\s*$/i', $text) === 1) {
            return self::INTENT_WORK;
        }

        return self::INTENT_UNKNOWN;
    }

    protected function readyPrompt(string $intent): string
    {
        return match ($intent) {
            self::INTENT_WORK => 'Here is what you have to work on.',
            self::INTENT_PROGRESS => 'Here is your progress.',
            self::INTENT_REMINDERS => 'Here are your reminders.',
            default => self::UNKNOWN_PROMPT,
        };
    }

    /**
     * @param  list<array{id: int, code: string, title: string}>  $projects
     * @return array<string, mixed>
     */
    protected function leadSlots(string $text, array $projects): array
    {
        $phone = null;
        $email = null;

        if (preg_match('/\b(?:\+?92[\s-]?)?0?3\d{2}[\s-]?\d{7}\b|\b\d{10,13}\b/', $text, $phoneMatch) === 1) {
            $phone = preg_replace('/\D+/', '', $phoneMatch[0]) ?? null;
        }

        if (preg_match('/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i', $text, $emailMatch) === 1) {
            $email = $emailMatch[0];
        }

        [$firstName, $lastName] = $this->nameFrom($text);
        $project = $this->projectFrom($text, $projects);

        return [
            'first_name' => $firstName,
            'last_name' => $lastName,
            'phone_number' => $phone,
            'email_address' => $email,
            'budget' => $this->budgetFrom($text),
            'project_id' => $project['id'] ?? null,
            'project_code' => $project['code'] ?? null,
            'project_title' => $project['title'] ?? null,
            'next_action' => $this->nextActionFrom($text),
        ];
    }

    /**
     * @return array{0: ?string, 1: ?string}
     */
    protected function nameFrom(string $text): array
    {
        $captured = null;

        if (preg_match('/\b(?:for|named|called)\s+([A-Za-z]+(?:\s+[A-Za-z]+){0,2})/i', $text, $match) === 1) {
            $captured = $match[1];
        } elseif (preg_match('/\blead\s+([A-Za-z]+(?:\s+[A-Za-z]+){0,2})/i', $text, $match) === 1) {
            $captured = $match[1];
        }

        if ($captured === null) {
            return [null, null];
        }

        $words = array_values(array_filter(
            preg_split('/\s+/', $captured) ?: [],
            fn (string $word): bool => ! in_array(strtolower($word), ['for', 'named', 'called', 'a', 'the', 'phone', 'email', 'with'], true),
        ));

        if ($words === []) {
            return [null, null];
        }

        return [$words[0], count($words) > 1 ? implode(' ', array_slice($words, 1)) : null];
    }

    /**
     * @param  list<array{id: int, code: string, title: string}>  $projects
     * @return array{id: int, code: string, title: string}|null
     */
    protected function projectFrom(string $text, array $projects): ?array
    {
        $match = null;
        $length = 0;

        foreach ($projects as $project) {
            $title = trim($project['title']);

            if ($title === '') {
                continue;
            }

            if (mb_stripos($text, $title) === false) {
                continue;
            }

            if (mb_strlen($title) > $length) {
                $match = $project;
                $length = mb_strlen($title);
            }
        }

        return $match;
    }

    protected function budgetFrom(string $text): ?float
    {
        if (preg_match('/\bbudget\s+(\d+(?:\.\d+)?)\s*(million|m|crore|lakh|k)?\b/i', $text, $match) !== 1) {
            return null;
        }

        $amount = (float) $match[1];
        $unit = strtolower($match[2] ?? '');

        $amount = match ($unit) {
            'million', 'm' => $amount * 1_000_000,
            'crore' => $amount * 10_000_000,
            'lakh' => $amount * 100_000,
            'k' => $amount * 1_000,
            default => $amount,
        };

        return $amount;
    }

    protected function nextActionFrom(string $text): ?string
    {
        if (preg_match('/\bnext(?:\s+action)?\s+(call|meeting|site visit|email|message)\b/i', $text, $match) !== 1) {
            return null;
        }

        return ucwords(strtolower($match[1]));
    }

    /**
     * @param  array<string, mixed>  $slots
     * @return list<string>
     */
    protected function missingLeadFields(array $slots): array
    {
        $missing = [];

        if (blank($slots['first_name'])) {
            $missing[] = 'name';
        }

        if (blank($slots['phone_number']) && blank($slots['email_address'])) {
            $missing[] = 'phone_or_email';
        }

        return $missing;
    }

    /**
     * @param  list<string>  $missing
     */
    protected function leadPrompt(array $missing): string
    {
        if (in_array('name', $missing, true)) {
            return 'Who is the lead for?';
        }

        if (in_array('phone_or_email', $missing, true)) {
            return 'What is their phone or email?';
        }

        return 'Confirm this lead before saving.';
    }
}
