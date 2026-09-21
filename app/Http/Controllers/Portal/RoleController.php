<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\StoreRoleRequest;
use App\Http\Requests\Portal\UpdateRoleRequest;
use App\Models\Role;
use App\Support\TenantPermissions;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class RoleController extends Controller
{
    public function index(Request $request): Response
    {
        $roles = Role::query()
            ->with(['permissions:id,name,label,group'])
            ->orderBy('name')
            ->get()
            ->map(fn (Role $role): array => [
                'id' => $role->id,
                'name' => $role->name,
                'description' => $role->description,
                'permissions' => $role->permissions
                    ->sortBy('name')
                    ->values()
                    ->map(fn ($permission): array => [
                        'id' => $permission->id,
                        'name' => $permission->name,
                        'label' => $permission->label,
                        'group' => $permission->group,
                    ]),
            ]);

        return Inertia::render('user-roles/index', [
            'roles' => $roles,
            'permissionGroups' => TenantPermissions::groupedForForm(),
        ]);
    }

    public function store(StoreRoleRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        $role = Role::query()->create([
            'name' => $validated['name'],
            'guard_name' => 'web',
            'description' => $validated['description'] ?? null,
        ]);

        $role->syncPermissions($validated['permissions'] ?? []);

        return to_route('portal.roles.index');
    }

    public function update(UpdateRoleRequest $request, Role $role): RedirectResponse
    {
        $validated = $request->validated();

        $role->forceFill([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
        ])->save();

        $role->syncPermissions($validated['permissions'] ?? []);

        return to_route('portal.roles.index');
    }

    public function destroy(Role $role): RedirectResponse
    {
        $role->delete();

        return to_route('portal.roles.index');
    }
}
