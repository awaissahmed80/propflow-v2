import {
  Dialog,  
  DialogContent,  
  DialogFooter,
  DialogHeader,  
  DialogPortal,
  DialogTitle,  
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { cva } from "class-variance-authority"


const Modal = ({title, isOpen, hideTitle=false, hideClose=false, closeable = true, onClose, size="default", toolbar, footer, variant="default", children}) => {

    const modalVariants = cva(
        "",
        {
            variants: {
                variant: {
                    default:"",
                    top: "top-0 translate-y-0 mt-4"
                },
                size: {
                    default: "lg:min-w-[580px]",
                    sm: "lg:min-w-[440px]",
                    lg: "lg:min-w-[800px]",
                    xl: "lg:min-w-[1000px]",
                }
            },
            defaultVariants: {      
                variant: "default",      
                size: "default",
            },
        }
    );  

    return(
        <Dialog open={isOpen} onOpenChange={onClose} closeable={closeable}>
            <DialogPortal>
                
                    <DialogContent 
                        {
                            ...(!closeable) && {
                                onEscapeKeyDown: (e) => e.preventDefault(),
                                onInteractOutside: (e) => e.preventDefault()
                            }
                        }     
                        closeable={closeable}        
                        hideClose={hideClose}           
                        aria-describedby={undefined} className={cn(modalVariants({ variant: variant, size, className: 'max-h-[90vh] flex flex-col gap-0 space-y-0 p-0' }))}>
                        { (title) &&
                            <DialogHeader className="px-5 py-3 border-b m-0">
                                <DialogTitle>{title}</DialogTitle>                    
                            </DialogHeader>
                        }
                        {
                            (hideTitle) &&
                            <DialogHeader className="px-5 py-3 border-b m-0 hidden">
                                <DialogTitle>{title}</DialogTitle>                    
                            </DialogHeader>

                        }
                        {
                            (toolbar) &&
                            <div className="flex flex-row items-center px-5 py-3 border-b">
                                {toolbar}
                            </div>
                        }                        
                        <div className="flex-1 overflow-y-auto min-h-24">                            
                                {children}                            
                        </div>
                        { (footer) &&
                            <DialogFooter className="justify-end items-center space-x-3 flex-row">
                                {footer}
                            </DialogFooter>
                        }
                    </DialogContent>
                
            </DialogPortal>
        </Dialog>
    )
}


export { Modal }