export const menu_items = [
    {
        title: 'Home',
        items: [
            { label: 'Dashboard', to: '/', icon: 'dashboard-2-line' },
            { label: 'Leads', to: '/leads', icon: 'customer-service-line' },            
            { label: 'Campaigns', to: '/campaigns', icon: 'focus-3-line' },
            { label: 'Projects', to: '/projects', icon: 'community-line' },
            { label: 'Inventory', to: '/inventory', icon: 'shape-line' },
            { label: 'Teams', to: '/teams', icon: 'user-community-line' },
            { label: 'Users', to: '/users', icon: 'user-2-line' },
            { label: 'Contacts', to: '/contacts', icon: 'folder-user-line' },
            { label: 'Calendar', to: '/calendar', icon: 'calendar-line' },
        ]
    },
    {
        title: 'Operations',
        items: [
            { label: 'Orders', to: '/orders', icon: 'book-2-line' },
            { label: 'Payment Plans', to: '/payment-plans', icon: 'calendar-schedule-line' },
            { label: 'Allocation', to: '/Allocation', icon: 'shape-line' },
        ]
    },
    {
        title: 'Library',
        items: [            
            { label: 'Files & Media', to: '/file-manager', icon: 'folder-2-line' },            
        ]
    },    
    {
        title: 'Analytics',
        items: [
            { label: 'Reports', to: '/reports', icon: 'dashboard-2-line' },
            { label: 'Forcasts', to: '/files', icon: 'filter-line' },
            { label: 'Finance', to: '/agreements', icon: 'focus-3-line' }            
        ]
    },
    {
        title: 'Administration',
        items: [
            // { label: 'Users', to: '/users', icon: 'user-line' },
            { label: 'Roles', to: '/user-roles', icon: 'checkbox-multiple-line' },
            // { label: 'Import/Export', to: '/import-export', icon: 'checkbox-multiple-line' },
            { label: 'Settings', to: '/settings', icon: 'settings-2-line' }            
        ]
    }    

]