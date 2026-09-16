<?php

namespace App\Http\Resources\Portal;

use App\Models\TenantUser;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin TenantUser
 */
class UserListResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $user = $this->user;

        return [
            'id' => $user->id,
            'code' => $this->code,
            'display_name' => $user->display_name,
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'email_address' => $user->email_address,
            'phone_number' => $user->phone_number,
            'title' => $this->title,
            'department' => $this->department,
            'manager_id' => $this->manager_id,
            'is_owner' => (bool) $this->is_owner,
            'roles' => $user->relationLoaded('roles')
                ? $user->roles->pluck('name')->values()->all()
                : $user->getRoleNames()->values()->all(),
            'avatar' => $this->avatar_url,
        ];
    }
}
