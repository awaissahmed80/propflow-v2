import { AbilityProvider } from '../contexts/ability.context';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useMeta } from '@/hooks/use-meta';
import { AppSidebar } from '../components/app-sidebar';

export default function PortalLayout ({ children }) {

    const isOpen = useMeta()?.sidebarOpen || false
    
    return(
        <AbilityProvider>
            <div className="h-dvh flex overflow-y-hidden space-x-0">
                <SidebarProvider defaultOpen={isOpen}>
                    <AppSidebar />                    
                    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
                        {children}
                    </div>                                                
                </SidebarProvider>
            </div>            
        </AbilityProvider>
    )
}