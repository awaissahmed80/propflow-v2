<?php

namespace App\Support\Assistant;

class AssistantInterpreter
{
    public const INTENT_WORK = 'work';

    public const INTENT_PROGRESS = 'progress';

    public const INTENT_REMINDERS = 'reminders';

    public const INTENT_CREATE_LEAD = 'create_lead';

    public const INTENT_CALENDAR = 'calendar';

    public const INTENT_DEALS = 'deals';

    public const INTENT_FIND_LEAD = 'find_lead';

    public const INTENT_OPEN = 'open';

    public const INTENT_GREETING = 'greeting';

    public const INTENT_HELP = 'help';

    public const INTENT_CLEAR_REMINDERS = 'clear_reminders';

    public const INTENT_LOG_ACTIVITY = 'log_activity';

    public const INTENT_UNKNOWN = 'unknown';

    public const UNKNOWN_PROMPT = 'I can only do the following.';

    public const ASK_PROMPT = 'What would you like to do?';

    /**
     * @param  list<array{id: int, code: string, title: string}>  $projects
     * @param  array{intent?: string, slots?: array<string, mixed>, missing?: list<string>}  $context
     * @return array{
     *     intent: string,
     *     slots: array<string, mixed>,
     *     missing: list<string>,
     *     prompt: string,
     *     ask: ?string,
     *     options: list<array{id: string, label: string, text: string}>,
     *     confirm: bool
     * }
     */
    public function interpret(string $transcript, array $projects = [], array $context = [], ?string $intentHint = null): array
    {
        $text = $this->normalize($transcript);
        $pendingIntent = is_string($context['intent'] ?? null) ? $context['intent'] : null;
        $pendingSlots = is_array($context['slots'] ?? null) ? $context['slots'] : [];
        $pendingMissing = is_array($context['missing'] ?? null) ? array_values($context['missing']) : [];

        if ($pendingIntent && $pendingMissing !== [] && ! $this->isFreshCommand($text)) {
            return $this->continuePending($pendingIntent, $pendingSlots, $pendingMissing, $text, $projects);
        }

        $intent = $this->intent($text);
        $intent = $this->applyIntentHint($intent, $intentHint);

        return match ($intent) {
            self::INTENT_CREATE_LEAD => $this->createLeadResult($text, $projects, $pendingSlots),
            self::INTENT_FIND_LEAD => $this->findLeadResult($text),
            self::INTENT_LOG_ACTIVITY => $this->logActivityResult($text),
            self::INTENT_OPEN => $this->openResult($text),
            self::INTENT_CLEAR_REMINDERS => $this->result(
                self::INTENT_CLEAR_REMINDERS,
                'Clear all unread reminders?',
                [],
                [],
                confirm: true,
            ),
            self::INTENT_HELP => $this->result(self::INTENT_HELP, 'I can help with these.'),
            default => $this->result(
                $intent,
                $intent === self::INTENT_UNKNOWN ? self::UNKNOWN_PROMPT : $this->readyPrompt($intent),
            ),
        };
    }

    /**
     * Prefer the on-device classifier only when regex could not decide.
     */
    protected function applyIntentHint(string $intent, ?string $intentHint): string
    {
        if ($intent !== self::INTENT_UNKNOWN) {
            return $intent;
        }

        if (! is_string($intentHint) || $intentHint === '') {
            return $intent;
        }

        $allowed = [
            self::INTENT_WORK,
            self::INTENT_PROGRESS,
            self::INTENT_REMINDERS,
            self::INTENT_CREATE_LEAD,
            self::INTENT_CALENDAR,
            self::INTENT_DEALS,
            self::INTENT_FIND_LEAD,
            self::INTENT_OPEN,
            self::INTENT_GREETING,
            self::INTENT_HELP,
            self::INTENT_CLEAR_REMINDERS,
            self::INTENT_LOG_ACTIVITY,
        ];

        return in_array($intentHint, $allowed, true) ? $intentHint : $intent;
    }

    /**
     * @return list<array{id: string, label: string, text: string}>
     */
    public static function choices(): array
    {
        return [
            ['id' => 'work', 'label' => "Today's work", 'text' => 'what do I have today'],
            ['id' => 'progress', 'label' => 'Lead stats', 'text' => 'how many leads do I have'],
            ['id' => 'reminders', 'label' => 'Reminders', 'text' => 'any reminders'],
            ['id' => 'calendar', 'label' => 'Calendar', 'text' => 'my calendar'],
            ['id' => 'create_lead', 'label' => 'New lead', 'text' => 'new lead'],
            ['id' => 'deals', 'label' => 'My deals', 'text' => 'my deals'],
            ['id' => 'find_lead', 'label' => 'Find a lead', 'text' => 'find a lead'],
            ['id' => 'log_activity', 'label' => 'Log a call', 'text' => 'log a call'],
            ['id' => 'clear_reminders', 'label' => 'Clear reminders', 'text' => 'clear reminders'],
            ['id' => 'leads', 'label' => 'Leads', 'text' => 'open leads'],
            ['id' => 'contacts', 'label' => 'Contacts', 'text' => 'open contacts'],
            ['id' => 'campaigns', 'label' => 'Campaigns', 'text' => 'open campaigns'],
            ['id' => 'inventory', 'label' => 'Inventory', 'text' => 'open inventory'],
        ];
    }

    protected function normalize(string $transcript): string
    {
        $text = strtolower(trim(preg_replace('/\s+/', ' ', $transcript) ?? ''));
        $text = str_replace(['’', '‘'], "'", $text);

        return $text;
    }

    protected function isFreshCommand(string $text): bool
    {
        return $this->looksLikeNewCommand($text);
    }

    protected function looksLikeNewCommand(string $text): bool
    {
        return (bool) preg_match(
            '/\b(?:what do i have|what should i|my work|today(?:\'s)? work|to-?dos?|pending|overdue|my progress|how am i|how many leads|lead(?:s)? (?:count|stats?|total)|total leads|reminders?|notifications?|alerts?|new lead|create lead|add lead|start lead|add (?:a )?prospect|lead for|calendars?|events?|schedule|appointments?|my deals|my orders|find (?:a )?lead|search|look up|who(?:\'s| is)|open |show |go to |clear reminders|mark (?:them |all )?read|log (?:a )?(?:call|meeting)|i called|help|what can you|how are you|hello|hi|hey)\b/i',
            $text,
        );
    }

    protected function intent(string $text): string
    {
        if ($text === '') {
            return self::INTENT_UNKNOWN;
        }

        if (preg_match('/\b(?:new|create|add|start)\b(?:\s+\w+){0,4}\s+(?:lead|prospect)\b/i', $text) === 1
            || preg_match('/\b(?:lead|prospect)\s+for\b/i', $text) === 1
            || preg_match('/\bcapture\s+(?:a\s+)?lead\b/i', $text) === 1) {
            return self::INTENT_CREATE_LEAD;
        }

        if (preg_match('/\bclear\s+reminders\b|\bmark\s+(?:all\s+)?(?:reminders?|notifications?)\s+read\b|\bmark\s+(?:them|all)\s+read\b/i', $text) === 1) {
            return self::INTENT_CLEAR_REMINDERS;
        }

        if (preg_match('/\blog\s+(?:a\s+)?(?:call|meeting|site visit|email|message|note)\b|\bi\s+(?:just\s+)?(?:called|met|messaged|emailed)\b|\brecord\s+(?:a\s+)?(?:call|meeting)\b/i', $text) === 1) {
            return self::INTENT_LOG_ACTIVITY;
        }

        if (preg_match('/\bcalendars?\b|\bevents?\b|\bschedule\b|\bscheduled\b|\bappointments?\b|\bsite visits?\b|\banything\s+(?:on\s+)?(?:my\s+)?(?:calendar|schedule)\b|\bmeetings?\s+(?:today|this week|coming up)\b/i', $text) === 1) {
            return self::INTENT_CALENDAR;
        }

        if (preg_match('/\breminders?\b|\bnotifications?\b|\balerts?\b|\bunread\b/i', $text) === 1) {
            return self::INTENT_REMINDERS;
        }

        if (preg_match('/\bhow many leads\b|\blead(?:s)?\s+(?:count|stats?|total)\b|\btotal leads\b|\bhow many\s+(?:open\s+)?(?:leads?|prospects?)\b|\bleads? do i have\b|\bmy progress\b|\bhow am i(?:\s+doing)?\b|\bprogress\b|\bmy stats\b|\bmy numbers\b|\blead stats\b/i', $text) === 1) {
            return self::INTENT_PROGRESS;
        }

        if (preg_match('/\bwhat do i have\b|\bwhat should i\b|\bmy work\b|\btoday(?:\'s)? work\b|\bto-?dos?\b|\bpending\b|\boverdue\b|\banything due\b|\bagenda\b|^\s*today\s*$/i', $text) === 1) {
            return self::INTENT_WORK;
        }

        if (preg_match('/\b(?:my|open)\s+(?:deals?|orders?|bookings?)\b/i', $text) === 1) {
            return self::INTENT_DEALS;
        }

        if (preg_match('/\b(?:find|search|look up)\b.*\b(?:lead|prospect)\b/i', $text) === 1
            || preg_match('/\bwho(?:\'s| is)\b/i', $text) === 1
            || preg_match('/\b(?:find|search|look up)\s+[a-z]{2,}/i', $text) === 1) {
            return self::INTENT_FIND_LEAD;
        }

        if (preg_match('/\b(?:open|show|go to)\s+(?:the\s+)?(?:dashboard|leads|contacts|campaigns|projects|inventory|teams|users|orders|activity|settings|roles)\b/i', $text) === 1) {
            return self::INTENT_OPEN;
        }

        if (preg_match('/\bhelp\b|\bwhat can you\b|\bwhat do you do\b|\bcapabilities\b|\bcommands\b/i', $text) === 1) {
            return self::INTENT_HELP;
        }

        if (preg_match('/\bhow are you\b|\bhow(?:\'s| is) it going\b|\b(?:hello|hi|hey)\b|\bgood (?:morning|afternoon|evening)\b|\bwhat(?:\'s| is) up\b|\bwho are you\b/i', $text) === 1) {
            return self::INTENT_GREETING;
        }

        return self::INTENT_UNKNOWN;
    }

    protected function readyPrompt(string $intent): string
    {
        return match ($intent) {
            self::INTENT_WORK => 'Here is what you have to work on.',
            self::INTENT_PROGRESS => 'Here are your lead stats.',
            self::INTENT_REMINDERS => 'Here are your reminders.',
            self::INTENT_CALENDAR => 'Here is your calendar.',
            self::INTENT_DEALS => 'Here are your deals.',
            self::INTENT_GREETING => "I'm doing well.",
            self::INTENT_HELP => 'I can help with these.',
            default => self::UNKNOWN_PROMPT,
        };
    }

    /**
     * @param  array<string, mixed>  $slots
     * @param  list<string>  $missing
     * @param  list<array{id: int, code: string, title: string}>  $projects
     * @return array{
     *     intent: string,
     *     slots: array<string, mixed>,
     *     missing: list<string>,
     *     prompt: string,
     *     ask: ?string,
     *     options: list<array{id: string, label: string, text: string}>,
     *     confirm: bool
     * }
     */
    protected function continuePending(
        string $intent,
        array $slots,
        array $missing,
        string $text,
        array $projects,
    ): array {
        return match ($intent) {
            self::INTENT_CREATE_LEAD => $this->createLeadResult($text, $projects, $slots, $missing),
            self::INTENT_FIND_LEAD => $this->findLeadResult($text, $slots),
            self::INTENT_LOG_ACTIVITY => $this->logActivityResult($text, $slots),
            default => $this->result(self::INTENT_UNKNOWN, self::UNKNOWN_PROMPT),
        };
    }

    /**
     * @param  list<array{id: int, code: string, title: string}>  $projects
     * @param  array<string, mixed>  $existing
     * @param  list<string>  $focusMissing
     * @return array{
     *     intent: string,
     *     slots: array<string, mixed>,
     *     missing: list<string>,
     *     prompt: string,
     *     ask: ?string,
     *     options: list<array{id: string, label: string, text: string}>,
     *     confirm: bool
     * }
     */
    protected function createLeadResult(string $text, array $projects, array $existing = [], array $focusMissing = []): array
    {
        $fresh = $this->leadSlots($text, $projects, $focusMissing);
        $slots = array_merge([
            'first_name' => null,
            'last_name' => null,
            'phone_number' => null,
            'email_address' => null,
            'budget' => null,
            'project_id' => null,
            'project_code' => null,
            'project_title' => null,
            'next_action' => null,
        ], $this->mergeSlots($existing, $fresh));
        $missing = $this->missingLeadFields($slots);

        return $this->result(self::INTENT_CREATE_LEAD, $this->leadPrompt($missing), $slots, $missing);
    }

    /**
     * @param  array<string, mixed>  $existing
     * @return array{
     *     intent: string,
     *     slots: array<string, mixed>,
     *     missing: list<string>,
     *     prompt: string,
     *     ask: ?string,
     *     options: list<array{id: string, label: string, text: string}>,
     *     confirm: bool
     * }
     */
    protected function findLeadResult(string $text, array $existing = []): array
    {
        $query = $this->lookupFrom($text) ?? ($existing['query'] ?? null);

        if ($query === null && preg_match('/^[a-z][a-z\s\'-]{1,40}$/i', $text) === 1) {
            $query = trim($text, " \t\n\r\0\x0B?.");
        }

        $slots = $this->mergeSlots($existing, ['query' => $query]);
        $missing = blank($slots['query'] ?? null) ? ['name'] : [];

        return $this->result(
            self::INTENT_FIND_LEAD,
            $missing === [] ? 'Here are the matching leads.' : 'Who should I look up?',
            $slots,
            $missing,
        );
    }

    /**
     * @param  array<string, mixed>  $existing
     * @return array{
     *     intent: string,
     *     slots: array<string, mixed>,
     *     missing: list<string>,
     *     prompt: string,
     *     ask: ?string,
     *     options: list<array{id: string, label: string, text: string}>,
     *     confirm: bool
     * }
     */
    protected function logActivityResult(string $text, array $existing = []): array
    {
        $action = $this->activityFrom($text) ?? ($existing['action'] ?? null);
        $query = $this->activityLeadFrom($text) ?? ($existing['query'] ?? null);

        if ($query === null && blank($existing['query'] ?? null) && preg_match('/^[a-z][a-z\s\'-]{1,40}$/i', $text) === 1
            && $this->activityFrom($text) === null) {
            $query = trim($text, " \t\n\r\0\x0B?.");
        }

        $slots = $this->mergeSlots($existing, [
            'action' => $action,
            'query' => $query,
            'comments' => 'Logged from assistant',
            'next_action' => 'Follow-up',
        ]);

        $missing = [];

        if (blank($slots['action'] ?? null)) {
            $missing[] = 'action';
        }

        if (blank($slots['query'] ?? null) && blank($slots['lead_code'] ?? null)) {
            $missing[] = 'lead';
        }

        $prompt = match (true) {
            in_array('action', $missing, true) => 'Was it a call, meeting, site visit, email, message, or note?',
            in_array('lead', $missing, true) => 'Which lead was that for?',
            default => 'Confirm this update before saving.',
        };

        return $this->result(self::INTENT_LOG_ACTIVITY, $prompt, $slots, $missing, confirm: $missing === []);
    }

    /**
     * @return array{
     *     intent: string,
     *     slots: array<string, mixed>,
     *     missing: list<string>,
     *     prompt: string,
     *     ask: ?string,
     *     options: list<array{id: string, label: string, text: string}>,
     *     confirm: bool
     * }
     */
    protected function openResult(string $text): array
    {
        $page = $this->pageFrom($text);

        if ($page === null) {
            return $this->result(self::INTENT_OPEN, self::UNKNOWN_PROMPT);
        }

        $options = $this->optionsForPage((string) $page['key']);

        return [
            'intent' => self::INTENT_OPEN,
            'slots' => $page,
            'missing' => [],
            'prompt' => $page['label'].' Overview',
            'ask' => self::ASK_PROMPT,
            'options' => $options,
            'confirm' => false,
        ];
    }

    /**
     * Related assistant actions for a CRM area overview.
     *
     * @return list<array{id: string, label: string, text: string}>
     */
    protected function optionsForPage(string $key): array
    {
        $sharedLead = [
            ['id' => 'create_lead', 'label' => 'New lead', 'text' => 'new lead'],
            ['id' => 'find_lead', 'label' => 'Find a lead', 'text' => 'find a lead'],
            ['id' => 'progress', 'label' => 'Lead stats', 'text' => 'how many leads do I have'],
        ];

        return match ($key) {
            'leads' => [
                ...$sharedLead,
                ['id' => 'log_activity', 'label' => 'Log a call', 'text' => 'log a call'],
                ['id' => 'work', 'label' => "Today's work", 'text' => 'what do I have today'],
                ['id' => 'calendar', 'label' => 'Calendar', 'text' => 'my calendar'],
            ],
            'campaigns' => [
                ...$sharedLead,
                ['id' => 'work', 'label' => "Today's work", 'text' => 'what do I have today'],
                ['id' => 'reminders', 'label' => 'Reminders', 'text' => 'any reminders'],
            ],
            'contacts' => [
                ...$sharedLead,
                ['id' => 'log_activity', 'label' => 'Log a call', 'text' => 'log a call'],
            ],
            'inventory' => [
                ['id' => 'deals', 'label' => 'My deals', 'text' => 'my deals'],
                ['id' => 'projects', 'label' => 'Projects', 'text' => 'open projects'],
                ['id' => 'create_lead', 'label' => 'New lead', 'text' => 'new lead'],
            ],
            'projects' => [
                ['id' => 'inventory', 'label' => 'Inventory', 'text' => 'open inventory'],
                ['id' => 'deals', 'label' => 'My deals', 'text' => 'my deals'],
                ['id' => 'create_lead', 'label' => 'New lead', 'text' => 'new lead'],
            ],
            'orders' => [
                ['id' => 'deals', 'label' => 'My deals', 'text' => 'my deals'],
                ['id' => 'progress', 'label' => 'Lead stats', 'text' => 'how many leads do I have'],
                ['id' => 'work', 'label' => "Today's work", 'text' => 'what do I have today'],
            ],
            'dashboard' => [
                ['id' => 'work', 'label' => "Today's work", 'text' => 'what do I have today'],
                ['id' => 'progress', 'label' => 'Lead stats', 'text' => 'how many leads do I have'],
                ['id' => 'calendar', 'label' => 'Calendar', 'text' => 'my calendar'],
                ['id' => 'reminders', 'label' => 'Reminders', 'text' => 'any reminders'],
                ['id' => 'deals', 'label' => 'My deals', 'text' => 'my deals'],
            ],
            'activity' => [
                ['id' => 'log_activity', 'label' => 'Log a call', 'text' => 'log a call'],
                ['id' => 'work', 'label' => "Today's work", 'text' => 'what do I have today'],
                ['id' => 'calendar', 'label' => 'Calendar', 'text' => 'my calendar'],
            ],
            'teams', 'users', 'roles', 'settings' => [
                ['id' => 'help', 'label' => 'What can you do?', 'text' => 'help'],
                ['id' => 'dashboard', 'label' => 'Dashboard', 'text' => 'open dashboard'],
            ],
            default => self::choices(),
        };
    }

    /**
     * @param  array<string, mixed>  $slots
     * @param  list<string>  $missing
     * @param  list<array{id: string, label: string, text: string}>|null  $options
     * @return array{
     *     intent: string,
     *     slots: array<string, mixed>,
     *     missing: list<string>,
     *     prompt: string,
     *     ask: ?string,
     *     options: list<array{id: string, label: string, text: string}>,
     *     confirm: bool
     * }
     */
    protected function result(
        string $intent,
        string $prompt,
        array $slots = [],
        array $missing = [],
        bool $confirm = false,
        ?array $options = null,
    ): array {
        $offerChoices = $missing === [] && ! $confirm;

        return [
            'intent' => $intent,
            'slots' => $slots,
            'missing' => $missing,
            'prompt' => $prompt,
            'ask' => $offerChoices ? self::ASK_PROMPT : null,
            'options' => $options ?? ($offerChoices ? self::choices() : []),
            'confirm' => $confirm,
        ];
    }

    /**
     * @param  array<string, mixed>  $existing
     * @param  array<string, mixed>  $fresh
     * @return array<string, mixed>
     */
    protected function mergeSlots(array $existing, array $fresh): array
    {
        foreach ($fresh as $key => $value) {
            if ($value === null || $value === '') {
                continue;
            }

            $existing[$key] = $value;
        }

        return $existing;
    }

    protected function lookupFrom(string $text): ?string
    {
        if (preg_match('/\bwho(?:\'s| is)\s+(.+)$/i', $text, $match) === 1) {
            return trim($match[1], " \t\n\r\0\x0B?.");
        }

        if (preg_match('/\b(?:find|search|look up)\b(?:\s+(?:a\s+)?(?:lead|prospect))?\s+(.+)$/i', $text, $match) === 1) {
            $query = trim($match[1], " \t\n\r\0\x0B?.");
            $query = preg_replace('/^(?:a\s+)?(?:lead|prospect)\s+/i', '', $query) ?? $query;

            return $query === '' ? null : $query;
        }

        return null;
    }

    protected function activityFrom(string $text): ?string
    {
        if (preg_match('/\b(call|meeting|site visit|email|message|note|whatsapp call|whatsapp message)\b/i', $text, $match) === 1) {
            return ucwords(strtolower($match[1]));
        }

        if (preg_match('/\bi\s+(?:just\s+)?called\b/i', $text) === 1) {
            return 'Call';
        }

        if (preg_match('/\bi\s+(?:just\s+)?met\b/i', $text) === 1) {
            return 'Meeting';
        }

        return null;
    }

    protected function activityLeadFrom(string $text): ?string
    {
        if (preg_match('/\b(?:for|with|about)\s+([a-z][a-z\s\'-]{1,40})$/i', $text, $match) === 1) {
            return trim($match[1], " \t\n\r\0\x0B?.");
        }

        if (preg_match('/\bi\s+(?:just\s+)?(?:called|met|messaged|emailed)\s+([a-z][a-z\s\'-]{1,40})$/i', $text, $match) === 1) {
            return trim($match[1], " \t\n\r\0\x0B?.");
        }

        return null;
    }

    /**
     * @return array{key: string, label: string, href: string}|null
     */
    protected function pageFrom(string $text): ?array
    {
        if (preg_match('/\b(?:open|show|go to|take me to|navigate to)\s+(?:the\s+)?(dashboard|leads|contacts|campaigns|projects|inventory|teams|users|orders|activity|settings|roles)\b/i', $text, $match) !== 1
            && preg_match('/\b(dashboard|leads|contacts|campaigns|projects|inventory|teams|users|orders|activity|settings|roles)\b/i', $text, $match) !== 1) {
            return null;
        }

        $page = strtolower($match[1]);
        $href = match ($page) {
            'dashboard' => '/',
            'leads' => '/leads',
            'contacts' => '/contacts',
            'campaigns' => '/campaigns',
            'projects' => '/projects',
            'inventory' => '/inventory',
            'teams' => '/teams',
            'users' => '/users',
            'orders' => '/bookings',
            'activity' => '/activity',
            'settings' => '/settings',
            'roles' => '/settings/roles',
            default => null,
        };

        if ($href === null) {
            return null;
        }

        $label = match ($page) {
            'dashboard' => 'Dashboard',
            'leads' => 'Leads',
            'contacts' => 'Contacts',
            'campaigns' => 'Campaigns',
            'projects' => 'Projects',
            'inventory' => 'Inventory',
            'teams' => 'Teams',
            'users' => 'Users',
            'orders' => 'Bookings',
            'activity' => 'Activity',
            'settings' => 'Settings',
            'roles' => 'Roles',
            default => ucfirst($page),
        };

        return [
            'key' => $page,
            'label' => $label,
            'href' => $href,
        ];
    }

    /**
     * @param  list<array{id: int, code: string, title: string}>  $projects
     * @param  list<string>  $focusMissing
     * @return array<string, mixed>
     */
    protected function leadSlots(string $text, array $projects, array $focusMissing = []): array
    {
        $phone = null;
        $email = null;

        if (preg_match('/\b(?:\+?92[\s-]?)?0?3\d{2}[\s-]?\d{7}\b|\b\d{10,13}\b/', $text, $phoneMatch) === 1) {
            $phone = preg_replace('/\D+/', '', $phoneMatch[0]) ?? null;
        }

        if (preg_match('/[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/i', $text, $emailMatch) === 1) {
            $email = $emailMatch[0];
        }

        [$firstName, $lastName] = $this->nameFrom($text, $focusMissing);
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
     * @param  list<string>  $focusMissing
     * @return array{0: ?string, 1: ?string}
     */
    protected function nameFrom(string $text, array $focusMissing = []): array
    {
        $captured = null;

        if (preg_match('/\b(?:for|named|called)\s+([a-z]+(?:\s+[a-z]+){0,2})/i', $text, $match) === 1) {
            $captured = $match[1];
        } elseif (preg_match('/\b(?:lead|prospect)\s+([a-z]+(?:\s+[a-z]+){0,2})/i', $text, $match) === 1) {
            $captured = $match[1];
        } elseif (in_array('name', $focusMissing, true) && preg_match('/^[a-z]+(?:\s+[a-z]+){0,2}$/i', $text) === 1) {
            $captured = $text;
        }

        if ($captured === null) {
            return [null, null];
        }

        $words = array_values(array_filter(
            preg_split('/\s+/', $captured) ?: [],
            fn (string $word): bool => ! in_array(strtolower($word), ['for', 'named', 'called', 'a', 'the', 'phone', 'email', 'with', 'lead', 'prospect'], true),
        ));

        if ($words === []) {
            return [null, null];
        }

        return [
            ucfirst(strtolower($words[0])),
            count($words) > 1 ? implode(' ', array_map(fn (string $word): string => ucfirst(strtolower($word)), array_slice($words, 1))) : null,
        ];
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

        return match ($unit) {
            'million', 'm' => $amount * 1_000_000,
            'crore' => $amount * 10_000_000,
            'lakh' => $amount * 100_000,
            'k' => $amount * 1_000,
            default => $amount,
        };
    }

    protected function nextActionFrom(string $text): ?string
    {
        if (preg_match('/\bnext(?:\s+action)?\s+(call|meeting|site visit|email|message|follow-?up)\b/i', $text, $match) !== 1) {
            return null;
        }

        $value = strtolower($match[1]);

        return match ($value) {
            'follow-up', 'followup' => 'Follow-up',
            default => ucwords($value),
        };
    }

    /**
     * @param  array<string, mixed>  $slots
     * @return list<string>
     */
    protected function missingLeadFields(array $slots): array
    {
        $missing = [];

        if (blank($slots['first_name'] ?? null)) {
            $missing[] = 'name';
        }

        if (blank($slots['phone_number'] ?? null) && blank($slots['email_address'] ?? null)) {
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
