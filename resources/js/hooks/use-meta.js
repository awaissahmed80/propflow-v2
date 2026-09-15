import { usePage } from '@inertiajs/react';

export const useMeta = () => {
    
    const { sidebarOpen } = usePage().props;
    return {        
        sidebarOpen
    };
}