<?php

namespace App\Support;

class TenantPermissions
{
    /**
     * Permission catalog for seeding and (later) the Add Role UI.
     *
     * Optional metadata per permission (for future CASL / role-form wiring):
     * - master: true — implies / disables related permissions in the group
     * - exclusive_set: string — at most one permission in the set may be granted
     * - disables: list of permission names cleared when this one is granted
     *
     * @return list<array{
     *     group: string,
     *     type?: string,
     *     permissions: list<array{
     *         name: string,
     *         label: string,
     *         master?: bool,
     *         exclusive_set?: string,
     *         disables?: list<string>
     *     }>
     * }>
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
                        'label' => 'Full admin access — settings, roles, import/export, and all administration items',
                        'master' => true,
                        'disables' => ['view activity', 'manage settings', 'manage integrations', 'manage pipeline', 'manage payment accounts', 'manage meta data'],
                    ],
                    [
                        'name' => 'view activity',
                        'label' => 'View workspace activity log',
                    ],
                    [
                        'name' => 'manage settings',
                        'label' => 'Edit general, configuration, and notification settings',
                    ],
                    [
                        'name' => 'manage integrations',
                        'label' => 'Connect or disconnect Meta, WhatsApp, and webhooks',
                    ],
                    [
                        'name' => 'manage pipeline',
                        'label' => 'Manage lead/order stages, statuses, and pipeline rules',
                    ],
                    [
                        'name' => 'manage payment accounts',
                        'label' => 'Manage bank and cash payment accounts',
                    ],
                    [
                        'name' => 'manage meta data',
                        'label' => 'Manage cities, countries, departments, and other meta lists',
                    ],
                ],
            ],
            [
                'group' => 'Users & Teams',
                'type' => 'checkbox',
                'permissions' => [
                    [
                        'name' => 'manage user',
                        'label' => 'Invite, update, and remove members; assign roles',
                        'master' => true,
                        'disables' => ['view users', 'invite user', 'manage roles'],
                    ],
                    [
                        'name' => 'view users',
                        'label' => 'View users list and profiles',
                    ],
                    [
                        'name' => 'invite user',
                        'label' => 'Send workspace invites only',
                    ],
                    [
                        'name' => 'manage roles',
                        'label' => 'Create, edit, and delete custom roles and permissions',
                    ],
                    [
                        'name' => 'manage team',
                        'label' => 'Full team create, edit, and delete',
                        'master' => true,
                        'disables' => ['edit team', 'view teams', 'view:own team'],
                    ],
                    [
                        'name' => 'edit team',
                        'label' => 'Create and edit teams (no delete)',
                        'disables' => ['view teams', 'view:own team'],
                    ],
                    [
                        'name' => 'view teams',
                        'label' => 'View all teams',
                        'disables' => ['view:own team'],
                    ],
                    [
                        'name' => 'view:own team',
                        'label' => 'View only assigned teams',
                    ],
                    [
                        'name' => 'team lead',
                        'label' => 'Act as team lead for assigned teams',
                    ],
                ],
            ],
            [
                'group' => 'Leads & Contacts',
                'type' => 'checkbox',
                'permissions' => [
                    [
                        'name' => 'manage contact',
                        'label' => 'Full contact create, edit, and delete',
                        'master' => true,
                        'disables' => ['view contacts', 'create contact', 'edit contact', 'delete contact'],
                    ],
                    [
                        'name' => 'view contacts',
                        'label' => 'View contacts',
                    ],
                    [
                        'name' => 'create contact',
                        'label' => 'Create contacts only',
                    ],
                    [
                        'name' => 'edit contact',
                        'label' => 'Edit contacts (no delete)',
                    ],
                    [
                        'name' => 'delete contact',
                        'label' => 'Delete contacts',
                    ],
                    [
                        'name' => 'manage lead',
                        'label' => 'All lead operations including delete and bulk actions',
                        'master' => true,
                        'exclusive_set' => 'lead_access',
                    ],
                    [
                        'name' => 'work lead',
                        'label' => 'Work all leads (create, update, tasks, stage)',
                        'exclusive_set' => 'lead_access',
                    ],
                    [
                        'name' => 'work:assigned lead',
                        'label' => 'Work only assigned leads',
                        'exclusive_set' => 'lead_access',
                    ],
                    [
                        'name' => 'view leads',
                        'label' => 'View all leads',
                        'exclusive_set' => 'lead_access',
                    ],
                    [
                        'name' => 'view:own lead',
                        'label' => 'View assigned leads only',
                        'exclusive_set' => 'lead_access',
                    ],
                    [
                        'name' => 'assign lead',
                        'label' => 'Assign or reassign leads',
                    ],
                    [
                        'name' => 'convert lead',
                        'label' => 'Convert lead to booking',
                    ],
                    [
                        'name' => 'archive lead',
                        'label' => 'Archive or restore leads',
                    ],
                    [
                        'name' => 'delete lead',
                        'label' => 'Permanently delete leads',
                    ],
                ],
            ],
            [
                'group' => 'Campaign Management',
                'type' => 'radio',
                'permissions' => [
                    [
                        'name' => 'manage campaign',
                        'label' => 'Full campaign and forms create, edit, and delete',
                        'exclusive_set' => 'campaign_access',
                    ],
                    [
                        'name' => 'assigned campaign',
                        'label' => 'Manage assigned campaigns only',
                        'exclusive_set' => 'campaign_access',
                    ],
                    [
                        'name' => 'view campaigns',
                        'label' => 'View campaigns',
                        'exclusive_set' => 'campaign_access',
                    ],
                ],
            ],
            [
                'group' => 'Accounts & Operations',
                'type' => 'checkbox',
                'permissions' => [
                    [
                        'name' => 'manage booking',
                        'label' => 'Full booking lifecycle',
                        'master' => true,
                        'exclusive_set' => 'booking_access',
                        'disables' => [
                            'view bookings',
                            'view:own booking',
                            'edit booking',
                            'assign booking',
                            'verify booking',
                            'allocate booking',
                            'cancel booking',
                            'record payment',
                            'generate plan',
                            'ballot booking',
                            'transfer booking',
                            'handover booking',
                            'litigation booking',
                        ],
                    ],
                    [
                        'name' => 'view bookings',
                        'label' => 'View all bookings',
                        'exclusive_set' => 'booking_access',
                    ],
                    [
                        'name' => 'view:own booking',
                        'label' => 'View assigned bookings only',
                        'exclusive_set' => 'booking_access',
                    ],
                    [
                        'name' => 'edit booking',
                        'label' => 'Update booking fields and notes',
                    ],
                    [
                        'name' => 'assign booking',
                        'label' => 'Assign bookings',
                    ],
                    [
                        'name' => 'verify booking',
                        'label' => 'Verify booking / KYC token flow',
                    ],
                    [
                        'name' => 'allocate booking',
                        'label' => 'Allocate unit / allotment board',
                    ],
                    [
                        'name' => 'cancel booking',
                        'label' => 'Cancel bookings',
                    ],
                    [
                        'name' => 'record payment',
                        'label' => 'Record payments and pay installments',
                    ],
                    [
                        'name' => 'generate plan',
                        'label' => 'Generate payment plans',
                    ],
                    [
                        'name' => 'ballot booking',
                        'label' => 'Run ballot',
                    ],
                    [
                        'name' => 'transfer booking',
                        'label' => 'Transfer buyer',
                    ],
                    [
                        'name' => 'handover booking',
                        'label' => 'Ready for handover / deliver',
                    ],
                    [
                        'name' => 'litigation booking',
                        'label' => 'Set or clear litigation',
                    ],
                    [
                        'name' => 'view receivables',
                        'label' => 'View installments and verification queue',
                    ],
                    [
                        'name' => 'manage receivables',
                        'label' => 'Operate verification and installment engine',
                        'master' => true,
                        'disables' => ['view receivables', 'view statements', 'view vouchers'],
                    ],
                    [
                        'name' => 'view statements',
                        'label' => 'View statements of account',
                    ],
                    [
                        'name' => 'view vouchers',
                        'label' => 'View payment vouchers',
                    ],
                    [
                        'name' => 'manage plan template',
                        'label' => 'Create, edit, and delete payment plan templates',
                        'master' => true,
                        'disables' => ['view plan templates'],
                    ],
                    [
                        'name' => 'view plan templates',
                        'label' => 'View payment plan templates',
                    ],
                    [
                        'name' => 'view commissions',
                        'label' => 'View agent and dealer commissions',
                    ],
                    [
                        'name' => 'manage commissions',
                        'label' => 'Configure and adjust commissions',
                        'master' => true,
                        'disables' => ['view commissions'],
                    ],
                ],
            ],
            [
                'group' => 'Projects & Inventory',
                'type' => 'checkbox',
                'permissions' => [
                    [
                        'name' => 'manage project',
                        'label' => 'Full project and progress create, edit, and delete',
                        'master' => true,
                        'disables' => ['edit project', 'view projects'],
                    ],
                    [
                        'name' => 'view projects',
                        'label' => 'View projects',
                    ],
                    [
                        'name' => 'edit project',
                        'label' => 'Edit projects and progress (no delete)',
                        'disables' => ['view projects'],
                    ],
                    [
                        'name' => 'manage inventory',
                        'label' => 'Units and blocks create, edit, and delete',
                        'master' => true,
                        'disables' => ['edit inventory', 'view inventory'],
                    ],
                    [
                        'name' => 'view inventory',
                        'label' => 'View inventory',
                    ],
                    [
                        'name' => 'edit inventory',
                        'label' => 'Edit units and blocks (no delete)',
                        'disables' => ['view inventory'],
                    ],
                ],
            ],
            [
                'group' => 'Documents & Media',
                'type' => 'checkbox',
                'permissions' => [
                    [
                        'name' => 'manage documents',
                        'label' => 'Upload and delete documents, folders, labels, and media',
                        'master' => true,
                        'disables' => ['view documents', 'upload documents', 'delete documents'],
                    ],
                    [
                        'name' => 'view documents',
                        'label' => 'Browse file manager and documents',
                    ],
                    [
                        'name' => 'upload documents',
                        'label' => 'Upload documents only',
                    ],
                    [
                        'name' => 'delete documents',
                        'label' => 'Delete files and media',
                    ],
                ],
            ],
            [
                'group' => 'Calendar, Todos & Sales',
                'type' => 'checkbox',
                'permissions' => [
                    [
                        'name' => 'view calendar',
                        'label' => 'View workspace calendar',
                    ],
                    [
                        'name' => 'view sales',
                        'label' => 'View sales overview',
                    ],
                    [
                        'name' => 'manage todos',
                        'label' => 'Manage team and workspace todos',
                    ],
                ],
            ],
            [
                'group' => 'Analytics',
                'type' => 'checkbox',
                'permissions' => [
                    [
                        'name' => 'view reports',
                        'label' => 'View reports, forecasts, and finance views',
                    ],
                ],
            ],
        ];
    }

    /**
     * System role names that cannot be edited (permissions/name/description) in any workspace.
     *
     * @return list<string>
     */
    public static function lockedRoleNames(): array
    {
        return ['Admin'];
    }

    public static function isLockedRole(string $name): bool
    {
        return in_array($name, self::lockedRoleNames(), true);
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
                'description' => 'Full control of the workspace — settings, users, and every module',
                'permissions' => self::names(),
            ],
            [
                'name' => 'Business Manager',
                'description' => 'Near-admin oversight without full administration master access',
                'permissions' => array_values(array_filter(
                    self::names(),
                    static fn (string $name): bool => $name !== 'manage admin'
                )),
            ],
            [
                'name' => 'Accounts Manager',
                'description' => 'Owns accounts, finance operations, and booking lifecycle actions',
                'permissions' => [
                    'manage payment accounts',
                    'view activity',
                    'view users',
                    'view teams',
                    'view bookings',
                    'edit booking',
                    'assign booking',
                    'verify booking',
                    'allocate booking',
                    'cancel booking',
                    'record payment',
                    'generate plan',
                    'ballot booking',
                    'transfer booking',
                    'handover booking',
                    'litigation booking',
                    'manage receivables',
                    'view statements',
                    'view vouchers',
                    'manage plan template',
                    'manage commissions',
                    'view projects',
                    'view inventory',
                    'edit inventory',
                    'manage documents',
                    'view calendar',
                    'view sales',
                    'view reports',
                ],
            ],
            [
                'name' => 'Sales Team Lead',
                'description' => 'Leads a sales team — assign work, oversee campaigns, and close deals',
                'permissions' => [
                    'view:own team',
                    'team lead',
                    'view users',
                    'assigned campaign',
                    'work lead',
                    'assign lead',
                    'convert lead',
                    'archive lead',
                    'manage contact',
                    'view bookings',
                    'edit booking',
                    'assign booking',
                    'view projects',
                    'view inventory',
                    'view documents',
                    'upload documents',
                    'view calendar',
                    'view sales',
                    'manage todos',
                ],
            ],
            [
                'name' => 'Accounts Team Lead',
                'description' => 'Leads accounts and operations teams on receivables and booking ops',
                'permissions' => [
                    'view:own team',
                    'team lead',
                    'view users',
                    'view bookings',
                    'edit booking',
                    'verify booking',
                    'allocate booking',
                    'record payment',
                    'generate plan',
                    'handover booking',
                    'manage receivables',
                    'view statements',
                    'view vouchers',
                    'view plan templates',
                    'view commissions',
                    'view projects',
                    'view inventory',
                    'view documents',
                    'upload documents',
                    'view calendar',
                    'view reports',
                    'manage todos',
                ],
            ],
            [
                'name' => 'Sales Executive',
                'description' => 'Works assigned leads and contacts to win bookings',
                'permissions' => [
                    'work:assigned lead',
                    'convert lead',
                    'view contacts',
                    'create contact',
                    'edit contact',
                    'view campaigns',
                    'view:own booking',
                    'view projects',
                    'view inventory',
                    'view documents',
                    'upload documents',
                    'view calendar',
                    'manage todos',
                ],
            ],
            [
                'name' => 'Finance',
                'description' => 'Records payments and reviews receivables, vouchers, and statements',
                'permissions' => [
                    'view bookings',
                    'record payment',
                    'verify booking',
                    'view receivables',
                    'view statements',
                    'view vouchers',
                    'view plan templates',
                    'view commissions',
                    'view documents',
                    'upload documents',
                    'view reports',
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
