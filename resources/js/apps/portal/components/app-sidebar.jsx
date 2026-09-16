import { Sidebar } from "@/components/ui/sidebar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { menu_items } from "../utils/menu_items"
import { NavLink } from "./nav-link"
import { NavUser } from "./nav-user"
import { Icon } from "@/components/ui/icon"

export function AppSidebar () {
    return(
        <Sidebar collapsible="offcanvas" variant="sidebar" className="flex h-screen p-0!  flex-col overflow-hidden">
            <div className="h-full  border-r-0">
                <div className="flex flex-col h-full">
                    <div className="border-b-0 flex items-center">
                        <div className="px-5 py-5">
                            <img className="h-8 w-auto block dark:hidden" src="/assets/images/propflow-logo-light.svg" alt="Propflow" />
                            <img className="h-8 w-auto hidden dark:block" src="/assets/images/propflow-logo-dark.svg" alt="Propflow" />
                        </div>
                    </div>
                     <div className="flex-1 relative">
                        <div className="absolute inset-0">
                            <ScrollArea className="h-full">
                                <div className="p-5 space-y-8">
                                {
                                    menu_items?.map((group, g) =>
                                        <div key={g} className="space-y-1">
                                            <div className="text-xs font-semibold uppercase mb-3 text-sidebar-foreground/30 px-3 ">{group?.title}</div>
                                            {
                                                group?.items?.map((item, i) =>
                                                    <NavLink href={item?.to} end={item?.to === '/'} key={i} className="flex px-3 text-sm font-medium rounded-md flex-row items-center py-1 hover:bg-card">
                                                        <Icon name={item?.icon} className="w-8 text-lg" />
                                                        {item?.label}
                                                    </NavLink>
                                                )
                                            }
                                        </div>
                                    )
                                }
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
                    <div className="p-3 border-t border-sidebar-border/50">
                        <NavUser />
                    </div>
                </div>
            </div>
        </Sidebar>
    )
}
