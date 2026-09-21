<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\StoreRoleRequest;
use App\Http\Requests\Portal\UpdateRoleRequest;
use App\Models\Role;
use Illuminate\Http\RedirectResponse;

class RoleController extends Controller
{
    public function index(): RedirectResponse
    {
        return $this->settingsRedirect();
    }

    public function store(StoreRoleRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        $role = Role::query()->create([
            'name' => $validated['name'],
            'guard_name' => 'web',
            'description' => $validated['description'] ?? null,
            'is_system' => false,
            'is_enabled' => true,
        ]);

        $role->syncPermissions($validated['permissions'] ?? []);

        return $this->settingsRedirect();
    }

    public function update(UpdateRoleRequest $request, Role $role): RedirectResponse
    {
        $validated = $request->validated();

        if (array_key_exists('is_enabled', $validated)) {
            $nextEnabled = (bool) $validated['is_enabled'];

            if (
                ! $nextEnabled
                && $role->is_enabled
                && Role::query()
                    ->enabled()
                    ->whereKeyNot($role->id)
                    ->doesntExist()
            ) {
                return back()->withErrors([
                    'role' => 'At least one enabled role is required.',
                ]);
            }
        }

        $role->forceFill([
            'name' => $validated['name'] ?? $role->name,
            'description' => array_key_exists('description', $validated)
                ? ($validated['description'] ?? null)
                : $role->description,
            'is_enabled' => array_key_exists('is_enabled', $validated)
                ? (bool) $validated['is_enabled']
                : $role->is_enabled,
        ])->save();

        if (array_key_exists('permissions', $validated)) {
            $role->syncPermissions($validated['permissions'] ?? []);
        }

        if ($request->boolean('toggle_only')) {
            return back();
        }

        return $this->settingsRedirect();
    }

    public function destroy(Role $role): RedirectResponse
    {
        if ($role->is_system) {
            return back()->withErrors([
                'role' => 'Default roles cannot be deleted. Turn them off instead.',
            ]);
        }

        if (Role::query()->enabled()->whereKeyNot($role->id)->doesntExist()) {
            return back()->withErrors([
                'role' => 'At least one enabled role is required.',
            ]);
        }

        $role->delete();

        return $this->settingsRedirect();
    }

    protected function settingsRedirect(): RedirectResponse
    {
        return redirect()->route('portal.settings.index', ['section' => 'roles']);
    }
}
