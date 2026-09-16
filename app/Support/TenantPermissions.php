<?php

namespace App\Support;

class TenantPermissions
{
    /**
     * Permission catalog for the Add Role UI (grouped toggles).
     *
     * @return list<array{group: string, type?: string, permissions: list<array{name: string, label: string}>}>
     */
    public static function catalog(): array
    {
        return [
            [
                'group' => 'Administration',
                'type' => 'checkbox',
                'permissions' => [
                    [
                        'name' => 'manage admin',
                        'label' => 'Can manage administration of application including, users, roles, site settings, import & export of data',
                    ],
                ],
            ],
            [
                'group' => 'Users & Role Management',
                'type' => 'checkbox',
                'permissions' => [
                    [
                        'name' => 'manage user',
                        'label' => 'Can manage all users, roles and permissions',
                    ],
                    [
                        'name' => 'view users',
                        'label' => 'Can view the list of users/roles',
                    ],
                ],
            ],
            [
                'group' => 'Team Management',
                'type' => 'checkbox',
                'permissions' => [
                    [
                        'name' => 'manage team',
                        'label' => 'Can manage teams (all operations)',
                    ],
                    [
                        'name' => 'edit team',
                        'label' => 'Can manage teams but cannot delete',
                    ],
                    [
                        'name' => 'view teams',
                        'label' => 'Can view all the teams',
                    ],
                    [
                        'name' => 'view:own team',
                        'label' => 'Can view assigned teams',
                    ],
                    [
                        'name' => 'team lead',
                        'label' => 'Can act as team lead for assigned teams',
                    ],
                ],
            ],
            [
                'group' => 'Project Management',
                'type' => 'checkbox',
                'permissions' => [
                    [
                        'name' => 'manage project',
                        'label' => 'Can manage all projects (create, edit, delete)',
                    ],
                    [
                        'name' => 'view projects',
                        'label' => 'Can view the list of projects',
                    ],
                ],
            ],
            [
                'group' => 'Inventory Management',
                'type' => 'checkbox',
                'permissions' => [
                    [
                        'name' => 'manage inventory',
                        'label' => 'Can manage inventory units and blocks (create, edit, delete)',
                    ],
                    [
                        'name' => 'view inventory',
                        'label' => 'Can view the inventory list',
                    ],
                ],
            ],
            [
                'group' => 'Campaign Management',
                'type' => 'radio',
                'permissions' => [
                    [
                        'name' => 'manage campaign',
                        'label' => 'Can manage all campaigns',
                    ],
                    [
                        'name' => 'assigned campaign',
                        'label' => 'Can manage assigned campaigns only',
                    ],
                ],
            ],
            [
                'group' => 'Leads Management',
                'type' => 'checkbox',
                'permissions' => [
                    [
                        'name' => 'work lead',
                        'label' => 'Can manage all leads',
                    ],
                ],
            ],
        ];
    }

    /**
     * Default tenant roles shown on the Roles & Permissions index.
     *
     * @return list<array{name: string, description: string, permissions: list<string>}>
     */
    public static function defaultRoles(): array
    {
        return [
            [
                'name' => 'Admin',
                'description' => 'admin with all permissions',
                'permissions' => self::names(),
            ],
            [
                'name' => 'Team Lead',
                'description' => 'team leader',
                'permissions' => [
                    'view:own team',
                    'assigned campaign',
                    'team lead',
                ],
            ],
            [
                'name' => 'Manager',
                'description' => 'Management Role',
                'permissions' => [
                    'manage user',
                    'manage team',
                    'manage campaign',
                ],
            ],
            [
                'name' => 'Sales Executive',
                'description' => 'Sales Executive / Leads Operator',
                'permissions' => [
                    'work lead',
                ],
            ],
        ];
    }

    /**
     * Flat permission names for syncing / checks.
     *
     * @return list<string>
     */
    public static function names(): array
    {
        $names = [];

        foreach (self::catalog() as $group) {
            foreach ($group['permissions'] as $permission) {
                $names[] = $permission['name'];
            }
        }

        return $names;
    }

    /**
     * Catalog keyed for API / Inertia props on the role form.
     *
     * @return list<array{group: string, type?: string, permissions: list<array{name: string, label: string}>}>
     */
    public static function groupedForForm(): array
    {
        return self::catalog();
    }
}
