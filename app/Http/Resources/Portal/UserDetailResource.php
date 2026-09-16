<?php

namespace App\Http\Resources\Portal;

use App\Models\TenantUser;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin TenantUser
 */
class UserDetailResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $user = $this->user;

        $subtitle = trim(implode(' ', array_filter([
            $this->title,
            $this->department ? '('.$this->department.')' : null,
        ])));

        return [
            'id' => $user->id,
            'display_name' => $user->display_name,
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'email_address' => $user->email_address,
            'phone_number' => $user->phone_number,
            'title' => $this->title,
            'department' => $this->department,
            'subtitle' => $subtitle !== '' ? $subtitle : null,
            'code' => $this->code,
            'status' => $this->status?->value ?? $user->status?->value,
            'manager_id' => $this->manager_id,
            'roles' => $this->role_names ?? [],
            'avatar' => $this->avatar_url,
            'manager' => $this->manager_data,
            'teams' => $this->teams_data ?? [],
            'stats' => $this->stats_data ?? [
                'leads' => 0,
                'teams' => 0,
                'tasks_due' => 0,
                'closed_deals' => 0,
            ],
        ];
    }
}
