<?php

namespace App\Http\Resources\Portal;

use App\Models\Contact;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Contact
 */
class ContactResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'display_name' => $this->display_name,
            'email_address' => $this->email_address,
            'phone_number' => $this->phone_number,
            'phone_number_alt' => $this->phone_number_alt,
            'cnic' => $this->cnic,
            'address' => $this->address,
            'city' => $this->city,
            'country' => $this->country,
            'contact_preference' => $this->contact_preference,
            'tag' => $this->tag,
            'income_level' => $this->income_level,
            'affordability' => $this->affordability,
            'capability' => $this->capability,
            'goal' => $this->goal,
            'net_worth' => $this->net_worth !== null ? (float) $this->net_worth : null,
            'type' => $this->type,
            'reference' => $this->reference,
            'leads_count' => (int) ($this->leads_count ?? 0),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
