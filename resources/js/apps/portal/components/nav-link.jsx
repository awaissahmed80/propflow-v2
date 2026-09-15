import { Link, usePage } from '@inertiajs/react'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui/icon';

export const  NavLink = ({ href, children, end=false,  className, ...rest }) => {

    const { url } = usePage()
    
    let isActive;
    if (end) {        
        isActive = url === href;
    } else {
        isActive = url === href || (href !== '/' && url.startsWith(href));
    }
        
    return (
        <Link href={href} className={cn(className, isActive ? 'bg-card text-primary' : "text-muted-foreground")} {...rest}>
            <span className="flex-1 flex flex-row items-center space-x-3">
                {children}
            </span>
            {
                (isActive) &&
                <Icon name="arrow-right-s-line" className="text-primary" />
            }
        </Link>
    )
}