<?php

namespace App\Models;

use App\Support\PermissionConnection;
use App\Support\TenantPermissions;
use Illuminate\Database\Eloquent\Builder;
use Spatie\Permission\Models\Role as SpatieRole;

class Role extends SpatieRole
{
    public function getConnectionName(): ?string
    {
        return PermissionConnection::name();
    }

    public function getRouteKeyName(): string
    {
        return 'name';
    }

    /**
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeEnabled(Builder $query): Builder
    {
        return $query->where('is_enabled', true);
    }

    /**
     * @return list<string>
     */
    public static function defaultNames(): array
    {
        return array_values(array_map(
            fn (array $role): string => $role['name'],
            TenantPermissions::defaultRoles(),
        ));
    }

    public function isDefault(): bool
    {
        return (bool) $this->is_system;
    }

    protected function casts(): array
    {
        return [
            'is_system' => 'boolean',
            'is_enabled' => 'boolean',
        ];
    }
}
