<?php

namespace App\Support;

class TenantPermissions
{
    /**
     * Permission catalog for the Add Role UI (grouped toggles).
     *
     * @return list<array{group: string, permissions: list<array{name: string, label: string}>}>
     */
    public static function catalog(): array
    {
        return [
            [
                'group' => 'Administration',
                'permissions' => [
                    [
                        'name' => 'manage admin',
                        'label' => 'Can manage administration of application including, users, roles, site settings, import & export of data',
                    ],
                ],
            ],
            [
                'group' => 'Users & Role Management',
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
                'group' => 'Campaign Management',
                'permissions' => [
                    [
                        'name' => 'manage campaign',
                        'label' => 'Can manage campaigns (all operations)',
                    ],
                    [
                        'name' => 'assigned campaign',
                        'label' => 'Can work on assigned campaigns',
                    ],
                ],
            ],
            [
                'group' => 'Leads Management',
                'permissions' => [
                    [
                        'name' => 'work lead',
                        'label' => 'Can work leads (Sales Executive / leads operator)',
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
     * Catalog keyed for API / Inertia props on the Add Role screen.
     *
     * @return list<array{group: string, permissions: list<array{name: string, label: string}>}>
     */
    public static function groupedForForm(): array
    {
        return self::catalog();
    }
}
