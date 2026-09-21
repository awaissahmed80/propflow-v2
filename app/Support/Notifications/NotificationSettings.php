<?php

namespace App\Support\Notifications;

class NotificationSettings
{
    /**
     * Workspace-wide notification defaults.
     *
     * Personal preferences will narrow these later; they do not replace them.
     *
     * @return list<array{id: string, label: string, description: string, items: list<array{key: string, title: string, description: string, default: bool}>}>
     */
    public static function catalog(): array
    {
        return [
            [
                'id' => 'channels',
                'label' => 'Channels',
                'description' => 'Where this workspace is allowed to send alerts',
                'items' => [
                    [
                        'key' => 'in_app',
                        'title' => 'In-App',
                        'description' => 'Show alerts in the portal',
                        'default' => true,
                    ],
                    [
                        'key' => 'email',
                        'title' => 'Email',
                        'description' => 'Send an email when an alert is raised',
                        'default' => true,
                    ],
                ],
            ],
            [
                'id' => 'leads',
                'label' => 'Leads',
                'description' => 'Alerts about new enquiries and follow-ups',
                'items' => [
                    [
                        'key' => 'lead_created',
                        'title' => 'New Lead',
                        'description' => 'When a lead is added from any source',
                        'default' => true,
                    ],
                    [
                        'key' => 'lead_assigned',
                        'title' => 'Lead Assigned',
                        'description' => 'When a lead is given to someone',
                        'default' => true,
                    ],
                    [
                        'key' => 'lead_stage_changed',
                        'title' => 'Stage Change',
                        'description' => 'When a lead moves to another stage',
                        'default' => false,
                    ],
                    [
                        'key' => 'follow_up_due',
                        'title' => 'Follow-Up Due',
                        'description' => 'When a follow-up date is today',
                        'default' => true,
                    ],
                    [
                        'key' => 'follow_up_overdue',
                        'title' => 'Follow-Up Overdue',
                        'description' => 'When a follow-up date has passed',
                        'default' => true,
                    ],
                ],
            ],
            [
                'id' => 'tasks',
                'label' => 'Tasks',
                'description' => 'Alerts about work assigned on a lead',
                'items' => [
                    [
                        'key' => 'task_assigned',
                        'title' => 'Task Assigned',
                        'description' => 'When a task is given to someone',
                        'default' => true,
                    ],
                    [
                        'key' => 'task_due',
                        'title' => 'Task Due',
                        'description' => 'When a task due date is reached',
                        'default' => true,
                    ],
                ],
            ],
            [
                'id' => 'deals',
                'label' => 'Deals',
                'description' => 'Alerts while a closed deal is being collected and handed over',
                'items' => [
                    [
                        'key' => 'installment_due',
                        'title' => 'Installment Due',
                        'description' => 'Seven days before an installment is due',
                        'default' => true,
                    ],
                    [
                        'key' => 'handover_ready',
                        'title' => 'Ready For Handover',
                        'description' => 'When a file is cleared for possession',
                        'default' => true,
                    ],
                ],
            ],
        ];
    }

    /**
     * @return array<string, bool>
     */
    public static function defaults(): array
    {
        $defaults = [];

        foreach (self::catalog() as $group) {
            foreach ($group['items'] as $item) {
                $defaults[$item['key']] = $item['default'];
            }
        }

        return $defaults;
    }
}
