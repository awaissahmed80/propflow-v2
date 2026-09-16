import { useEffect, useState } from "react"
import { Fragment } from "react/jsx-runtime"
import { cn } from "@/lib/utils"
import { Head, Link } from "@inertiajs/react"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,  
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { useOS } from "@/hooks/use-os"
import { SpotlightSearch } from "./spotlight-search"
import { IconButton } from "@/components/ui/icon-button"
import { useAuth } from "@/hooks/use-auth"
import dayjs from "dayjs"
import { Separator } from "@base-ui/react/separator"


function Layout ({className, children}) {

    return(
        <div className={cn("flex-1 h-full flex w-full flex-col", className)}>
            {children}
        </div>
    )
}

const LayoutHeader = ({title, metaTitle, breadcrumbs=[], showBack=false, children}) => {

    const os = useOS();
    const [ isOpen, setOpen ] = useState(false)
    const { user } = useAuth()
    
    useEffect(() => {
        const down = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            setOpen((open) => !open);
        }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

    return(
        <>
        <Head title={metaTitle || "Applicaiton"} />
        <div className="flex w-full items-center justify-between space-x-3 px-6 py-3">   
            <div className="flex flex-row items-center space-x-2">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical"  className="h-4 border-l border-muted-foreground/50 mr-4" />
                {
                    (showBack) &&
                    <Button variant="outline" size="smicon"  onClick={() => window.history.back()}>
                        <Icon name="arrow-left-line" />
                    </Button>
                }
                {
                    (breadcrumbs?.length === 0) &&
                    <div className="text-foreground/50">
                        It's {dayjs().format('dddd')}
                        <span className="font-semibold text-foreground/80"> {`${user?.display_name}`}</span>
                        — let's make it count!
                        {/* {`It's Wednesday, Awais — let's make it count!`} <span className="font-semibold text-foreground/80">{`${user?.first_name}`}</span> */}
                    </div>
                }   
                {
                    (breadcrumbs?.length > 0) &&
                    <Breadcrumb>
                        <BreadcrumbList>
                            <BreadcrumbItem>
                                <BreadcrumbLink render={<Link href='/'><Icon name="home-line" /></Link>} / >                                                                    
                            </BreadcrumbItem>
                            <BreadcrumbSeparator />
                        
                            {
                                breadcrumbs?.map((item, i) =>   
                                    <Fragment key={item?.label}>
                                        <BreadcrumbItem>
                                            {
                                                (item?.to) ?
                                                <BreadcrumbLink render={<Link href={item.to}>{item?.label}</Link>} />
                                                :
                                                <>{item?.label}</>   
                                            }                                            
                                        </BreadcrumbItem>
                                        { (i < (breadcrumbs?.length - 1)  ) &&  <BreadcrumbSeparator />}
                                    </Fragment>
                                )
                            }
                            
                        </BreadcrumbList>
                    </Breadcrumb>
                }
                <div className="font-semibold text-lg">
                    {title}
                </div>
            </div>
            <div className="flex-1">
                <div className="flex flex-row items-center justify-end">
                    <div className="w-full max-w-56">
                        <Button onClick={() => setOpen(true)} size="sm" className="w-full flex bg-transparent border-0 text-muted-foreground/60 px-3 pr-1 flex-row justify-between items-center hover:text-muted-foreground/90" variant="outline">
                            <span>Search....</span>
                            <kbd className="inline-flex items-center gap-1 rounded border bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                                <span className="text-[12px]">{ os === 'mac' ? '⌘' : 'Ctrl+'}</span>
                                <span className="text-[12px]">K</span>
                            </kbd>
                        </Button>
                    </div>
                </div>             
                {children}
            </div>            
            <div className="flex-row items-center space-x-3">        
                <IconButton size="sm" variant="outline" icon="discuss-line" />       
                <IconButton size="sm" variant="outline" icon="notification-3-line" />
                
            </div>
        </div>
        <SpotlightSearch isOpen={isOpen} onClose={() => setOpen(false)} />
        </>
    )
}

/**
 * Full-width page title / actions bar (top + bottom borders, edge-to-edge).
 */
const LayoutToolbar = ({ className, children, ...rest }) => {
    return (
        <div
            className={cn(
                "flex w-full shrink-0 items-center gap-4 border-t border-b border-border px-6 py-3",
                className
            )}
            {...rest}
        >
            {children}
        </div>
    )
}

const LayoutContent = ({children, className, ...rest}) => {

    return(
        <div className={cn("flex-1", className)} {...rest}>
            {children}
        </div>
    )
}

const LayoutFooter = ({children, ...rest}) => {

    return(
        <div {...rest}>
            {children}
        </div>
    )
}

Layout.Header = LayoutHeader
Layout.Toolbar = LayoutToolbar
Layout.Content = LayoutContent
Layout.Footer = LayoutFooter

export  { Layout }