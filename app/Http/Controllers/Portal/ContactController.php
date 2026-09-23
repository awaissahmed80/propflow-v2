<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\StoreContactRequest;
use App\Http\Requests\Portal\UpdateContactRequest;
use App\Http\Resources\Portal\ContactResource;
use App\Models\Contact;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ContactController extends Controller
{
    public function index(Request $request): Response
    {
        $query = $request->string('q')->trim()->toString();
        $types = $this->listParam($request, 'type');
        $tags = $this->listParam($request, 'tag');

        $paginator = Contact::query()
            ->withCount('leads')
            ->when($query !== '', function ($builder) use ($query): void {
                $builder->where(function ($inner) use ($query): void {
                    $inner->where('first_name', 'like', "%{$query}%")
                        ->orWhere('last_name', 'like', "%{$query}%")
                        ->orWhere('phone_number', 'like', "%{$query}%")
                        ->orWhere('email_address', 'like', "%{$query}%")
                        ->orWhere('cnic', 'like', "%{$query}%")
                        ->orWhere('reference', 'like', "%{$query}%")
                        ->orWhere('city', 'like', "%{$query}%");
                });
            })
            ->when($types !== [], fn ($builder) => $builder->whereIn('type', $types))
            ->when($tags !== [], fn ($builder) => $builder->whereIn('tag', $tags))
            ->latest('id')
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('contacts/index', [
            'contacts' => ContactResource::collection($paginator->getCollection())->resolve(),
            'pagination' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
            'filters' => [
                'q' => $query,
                'type' => $types,
                'tag' => $tags,
            ],
            'formOptions' => $this->formOptions(),
        ]);
    }

    /**
     * Lean contact card payload for popovers (lazy-loaded).
     */
    public function card(Contact $contact): JsonResponse
    {
        $contact->loadCount('leads');

        return response()->json([
            'data' => (new ContactResource($contact))->resolve(),
        ]);
    }

    public function store(StoreContactRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        Contact::query()->create([
            ...$validated,
            'tag' => $validated['tag'] ?? Contact::TAG_GENERAL,
            'type' => $validated['type'] ?? Contact::TYPE_LEAD,
            'income_level' => $validated['income_level'] ?? Contact::INCOME_MIDDLE,
            'affordability' => $validated['affordability'] ?? Contact::AFFORDABILITY_MODERATE,
            'capability' => $validated['capability'] ?? Contact::CAPABILITY_MODERATE,
            'net_worth' => $validated['net_worth'] ?? 0,
        ]);

        return to_route('portal.contacts.index');
    }

    public function update(UpdateContactRequest $request, Contact $contact): RedirectResponse
    {
        $validated = $request->validated();

        $contact->fill($validated);
        $contact->save();

        return back(fallback: route('portal.contacts.index'));
    }

    public function destroy(Contact $contact): RedirectResponse
    {
        $contact->forceDelete();

        return to_route('portal.contacts.index');
    }

    /**
     * @return array{
     *     tags: list<string>,
     *     types: list<string>,
     *     income_levels: list<string>,
     *     affordability_levels: list<string>,
     *     capability_levels: list<string>
     * }
     */
    protected function formOptions(): array
    {
        return [
            'tags' => Contact::tags(),
            'types' => Contact::types(),
            'income_levels' => Contact::incomeLevels(),
            'affordability_levels' => Contact::affordabilityLevels(),
            'capability_levels' => Contact::capabilityLevels(),
        ];
    }

    /**
     * @return list<string>
     */
    protected function listParam(Request $request, string $key): array
    {
        $value = $request->input($key);

        if (is_array($value)) {
            return collect($value)
                ->map(fn ($item): string => trim((string) $item))
                ->filter()
                ->values()
                ->all();
        }

        $string = trim((string) ($value ?? ''));

        if ($string === '') {
            return [];
        }

        return collect(explode(',', $string))
            ->map(fn (string $item): string => trim($item))
            ->filter()
            ->values()
            ->all();
    }
}
