<?php

namespace App\Services;

use App\Models\Campaign;
use App\Models\Contact;
use App\Models\Lead;
use App\Models\Order;
use App\Models\Project;
use App\Models\Team;
use App\Models\Tenant;
use App\Models\TenantUser;
use App\Models\Unit;

class GlobalSearch
{
    public const MIN_QUERY_LENGTH = 2;

    public const PER_GROUP_LIMIT = 5;

    /**
     * @return list<array{
     *     type: string,
     *     icon: string,
     *     items: list<array{id: string, title: string, subtitle: ?string, url: string, icon: string}>
     * }>
     */
    public function search(string $query): array
    {
        $query = trim($query);

        if (mb_strlen($query) < self::MIN_QUERY_LENGTH) {
            return [];
        }

        return collect([
            $this->leads($query),
            $this->contacts($query),
            $this->bookings($query),
            $this->projects($query),
            $this->campaigns($query),
            $this->inventory($query),
            $this->users($query),
            $this->teams($query),
        ])
            ->filter(fn (array $group): bool => $group['items'] !== [])
            ->values()
            ->all();
    }

    /**
     * @return array{type: string, icon: string, items: list<array{id: string, title: string, subtitle: ?string, url: string, icon: string}>}
     */
    protected function leads(string $query): array
    {
        $items = Lead::query()
            ->active()
            ->with(['contact:id,first_name,last_name,phone_number', 'project:id,title'])
            ->where(function ($builder) use ($query): void {
                $builder->where('code', 'like', "%{$query}%")
                    ->orWhere('source', 'like', "%{$query}%")
                    ->orWhere('notes', 'like', "%{$query}%")
                    ->orWhere('next_action', 'like', "%{$query}%")
                    ->orWhereHas('contact', fn ($contact) => $contact->matchingSearch($query));
            })
            ->latest('id')
            ->limit(self::PER_GROUP_LIMIT)
            ->get()
            ->map(function (Lead $lead): array {
                $name = $lead->contact?->display_name ?: 'Lead';

                return $this->item(
                    id: 'lead-'.$lead->id,
                    title: $name,
                    subtitle: collect([$lead->project?->title, $lead->code])->filter()->implode(' · '),
                    url: '/leads?lead='.$lead->code,
                    icon: 'customer-service-line',
                );
            })
            ->all();

        return $this->group('Leads', 'customer-service-line', $items);
    }

    /**
     * @return array{type: string, icon: string, items: list<array{id: string, title: string, subtitle: ?string, url: string, icon: string}>}
     */
    protected function contacts(string $query): array
    {
        $items = Contact::query()
            ->where(function ($builder) use ($query): void {
                $builder->matchingSearch($query)
                    ->orWhere('cnic', 'like', "%{$query}%")
                    ->orWhere('reference', 'like', "%{$query}%")
                    ->orWhere('city', 'like', "%{$query}%");
            })
            ->latest('id')
            ->limit(self::PER_GROUP_LIMIT)
            ->get()
            ->map(function (Contact $contact) use ($query): array {
                $q = $contact->phone_number
                    ?: $contact->email_address
                    ?: $contact->display_name
                    ?: $query;

                return $this->item(
                    id: 'contact-'.$contact->id,
                    title: $contact->display_name,
                    subtitle: collect([$contact->phone_number, $contact->email_address, $contact->city])
                        ->filter()
                        ->implode(' · '),
                    url: '/contacts?q='.rawurlencode((string) $q),
                    icon: 'contacts-book-line',
                );
            })
            ->all();

        return $this->group('Contacts', 'contacts-book-line', $items);
    }

    /**
     * @return array{type: string, icon: string, items: list<array{id: string, title: string, subtitle: ?string, url: string, icon: string}>}
     */
    protected function bookings(string $query): array
    {
        $items = Order::query()
            ->with(['contact:id,first_name,last_name', 'project:id,title', 'unit:id,name,code'])
            ->where('status', '!=', Order::STATUS_CANCELLED)
            ->where(function ($builder) use ($query): void {
                $builder->where('code', 'like', "%{$query}%")
                    ->orWhere('plot_or_file', 'like', "%{$query}%")
                    ->orWhereHas('contact', fn ($contact) => $contact->matchingSearch($query))
                    ->orWhereHas('project', fn ($project) => $project->where('title', 'like', "%{$query}%"))
                    ->orWhereHas('unit', function ($unit) use ($query): void {
                        $unit->where('name', 'like', "%{$query}%")
                            ->orWhere('code', 'like', "%{$query}%");
                    });
            })
            ->latest('id')
            ->limit(self::PER_GROUP_LIMIT)
            ->get()
            ->map(function (Order $order): array {
                $name = $order->contact?->display_name ?: 'Booking';

                return $this->item(
                    id: 'booking-'.$order->id,
                    title: $name,
                    subtitle: collect([
                        $order->project?->title,
                        $order->unit?->name ?: $order->unit?->code,
                        $order->code,
                    ])->filter()->implode(' · '),
                    url: '/bookings?booking='.$order->code,
                    icon: 'book-2-line',
                );
            })
            ->all();

        return $this->group('Bookings', 'book-2-line', $items);
    }

    /**
     * @return array{type: string, icon: string, items: list<array{id: string, title: string, subtitle: ?string, url: string, icon: string}>}
     */
    protected function projects(string $query): array
    {
        $needle = mb_strtolower($query);

        $items = Project::query()
            ->orderBy('title')
            ->get(['id', 'code', 'title', 'city', 'location', 'status', 'type', 'country'])
            ->filter(function (Project $project) use ($needle): bool {
                $haystack = mb_strtolower(implode(' ', array_filter([
                    $project->title,
                    $project->code,
                    $project->city,
                    $project->location,
                    $project->status,
                    $project->type,
                    $project->country,
                ])));

                return str_contains($haystack, $needle);
            })
            ->take(self::PER_GROUP_LIMIT)
            ->values()
            ->map(fn (Project $project): array => $this->item(
                id: 'project-'.$project->id,
                title: (string) $project->title,
                subtitle: collect([$project->city ?: $project->location, $project->code])->filter()->implode(' · '),
                url: '/projects/'.$project->code,
                icon: 'community-line',
            ))
            ->all();

        return $this->group('Projects', 'community-line', $items);
    }

    /**
     * @return array{type: string, icon: string, items: list<array{id: string, title: string, subtitle: ?string, url: string, icon: string}>}
     */
    protected function campaigns(string $query): array
    {
        $items = Campaign::query()
            ->where(function ($builder) use ($query): void {
                $builder->where('title', 'like', "%{$query}%")
                    ->orWhere('slug', 'like', "%{$query}%");
            })
            ->latest('id')
            ->limit(self::PER_GROUP_LIMIT)
            ->get(['id', 'title', 'slug', 'status', 'channel'])
            ->map(fn (Campaign $campaign): array => $this->item(
                id: 'campaign-'.$campaign->id,
                title: (string) $campaign->title,
                subtitle: collect([$campaign->status, $campaign->channel])->filter()->implode(' · '),
                url: '/campaigns/'.$campaign->slug,
                icon: 'focus-3-line',
            ))
            ->all();

        return $this->group('Campaigns', 'focus-3-line', $items);
    }

    /**
     * @return array{type: string, icon: string, items: list<array{id: string, title: string, subtitle: ?string, url: string, icon: string}>}
     */
    protected function inventory(string $query): array
    {
        $items = Unit::query()
            ->with('project:id,title,code')
            ->where(function ($builder) use ($query): void {
                $builder->where('name', 'like', "%{$query}%")
                    ->orWhere('code', 'like', "%{$query}%")
                    ->orWhere('sector', 'like', "%{$query}%")
                    ->orWhere('type', 'like', "%{$query}%");
            })
            ->latest('id')
            ->limit(self::PER_GROUP_LIMIT)
            ->get()
            ->map(fn (Unit $unit): array => $this->item(
                id: 'unit-'.$unit->id,
                title: (string) ($unit->name ?: $unit->code),
                subtitle: collect([$unit->project?->title, $unit->status, $unit->code])->filter()->implode(' · '),
                url: '/inventory?q='.rawurlencode((string) $unit->code),
                icon: 'building-2-line',
            ))
            ->all();

        return $this->group('Inventory', 'building-2-line', $items);
    }

    /**
     * @return array{type: string, icon: string, items: list<array{id: string, title: string, subtitle: ?string, url: string, icon: string}>}
     */
    protected function users(string $query): array
    {
        $tenant = Tenant::current();

        if ($tenant === null) {
            return $this->group('Users', 'user-line', []);
        }

        $needle = mb_strtolower($query);

        $items = TenantUser::query()
            ->with(['user:id,display_name,first_name,last_name,email_address,phone_number'])
            ->where('tenant_id', $tenant->id)
            ->orderBy('id')
            ->get()
            ->filter(fn (TenantUser $membership): bool => $membership->user !== null)
            ->filter(function (TenantUser $membership) use ($needle): bool {
                $haystack = mb_strtolower(implode(' ', array_filter([
                    $membership->user->display_name,
                    $membership->user->first_name,
                    $membership->user->last_name,
                    $membership->user->email_address,
                    $membership->user->phone_number,
                    $membership->title,
                    $membership->code,
                ])));

                return str_contains($haystack, $needle);
            })
            ->take(self::PER_GROUP_LIMIT)
            ->values()
            ->map(fn (TenantUser $membership): array => $this->item(
                id: 'user-'.$membership->id,
                title: (string) $membership->user->display_name,
                subtitle: collect([$membership->title, $membership->user->email_address])->filter()->implode(' · '),
                url: '/users?user='.rawurlencode((string) $membership->code),
                icon: 'user-line',
            ))
            ->all();

        return $this->group('Users', 'user-line', $items);
    }

    /**
     * @return array{type: string, icon: string, items: list<array{id: string, title: string, subtitle: ?string, url: string, icon: string}>}
     */
    protected function teams(string $query): array
    {
        $needle = mb_strtolower($query);

        $items = Team::query()
            ->with('leader:id,display_name')
            ->orderBy('title')
            ->get()
            ->filter(function (Team $team) use ($needle): bool {
                $haystack = mb_strtolower(implode(' ', array_filter([
                    $team->title,
                    $team->code,
                    $team->description,
                    $team->leader?->display_name,
                ])));

                return str_contains($haystack, $needle);
            })
            ->take(self::PER_GROUP_LIMIT)
            ->values()
            ->map(fn (Team $team): array => $this->item(
                id: 'team-'.$team->id,
                title: (string) $team->title,
                subtitle: collect([$team->code, $team->leader?->display_name])->filter()->implode(' · '),
                url: '/teams?q='.rawurlencode((string) $team->title),
                icon: 'user-community-line',
            ))
            ->all();

        return $this->group('Teams', 'user-community-line', $items);
    }

    /**
     * @param  list<array{id: string, title: string, subtitle: ?string, url: string, icon: string}>  $items
     * @return array{type: string, icon: string, items: list<array{id: string, title: string, subtitle: ?string, url: string, icon: string}>}
     */
    protected function group(string $type, string $icon, array $items): array
    {
        return [
            'type' => $type,
            'icon' => $icon,
            'items' => $items,
        ];
    }

    /**
     * @return array{id: string, title: string, subtitle: ?string, url: string, icon: string}
     */
    protected function item(
        string $id,
        string $title,
        ?string $subtitle,
        string $url,
        string $icon,
    ): array {
        return [
            'id' => $id,
            'title' => $title,
            'subtitle' => $subtitle !== '' ? $subtitle : null,
            'url' => $url,
            'icon' => $icon,
        ];
    }
}
