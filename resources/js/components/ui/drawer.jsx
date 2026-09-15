import {
  Sheet,  
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "./sheet"
import { cn } from "@/lib/utils"
import { cva } from "class-variance-authority"
import { ScrollArea } from "./scroll-area";

export const Drawer = ({title, isOpen, size="default", onClose, footer, actions, children}) => {

    const drawerVariants = cva(
        "border-0 bg-transparent p-2",
        {
            variants: {
                variant: {
                    default:""
                },
                size: {
                    default: "lg:min-w-[580px]",
                    sm: "lg:min-w-[440px]",
                    lg: "lg:min-w-[800px]",
                }
            },
            defaultVariants: {      
                variant: "default",      
                size: "default",
            },
        }
    );  

    return(        
        <Sheet open={isOpen} onOpenChange={onClose}>            
            <SheetContent side="right" className={cn(drawerVariants({ variant: "default", size, className: '' }))}>
                <div className="flex flex-col bg-muted flex-1 rounded-lg  gap-0">
                    {
                        (title || actions) &&
                        <SheetHeader className="border-b items-center flex-row justify-between">
                            <SheetTitle>{title}</SheetTitle>
                            <div className="flex flex-row items-center space-x-2">
                                {actions}
                            </div>
                        </SheetHeader>
                    }
                    <div className="flex-1 relative">
                        <div className="absolute inset-0">
                            <ScrollArea className="h-full relative py-5">
                                {children}                                
                            </ScrollArea>
                        
                        </div>
                    </div>
                    {
                        (footer) &&
                        <SheetFooter className="justify-end items-center space-x-3 flex-row border-t">
                            {footer}
                        </SheetFooter> 
                    }
                </div>
            </SheetContent>            
        </Sheet>        
    )
}