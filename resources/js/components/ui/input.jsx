import { useState } from "react";
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "@/lib/utils"
import { cva } from "class-variance-authority";
import { Label } from "./label"
import { Icon } from "./icon"
import { Tooltip } from "./tooltip"

const inputVariants = cva(
    cn(
    "flex items-center space-x-2 rounded-md bg-transparent border-input dark:bg-input/30",
    "h-control border outline-0 px-2.5 py-1 pr-0 text-sm shadow-xs transition-[color,box-shadow]",
    "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
    "has-[input:focus-within]:border-ring  has-[input:focus-within]:ring-ring/50 has-[input:focus-within]:ring-[1px]",
    "has-[input[aria-invalid='true']]:ring-destructive/20 dark:has-[input[aria-invalid='true']]:ring-destructive/40 has-[input[aria-invalid='true']]:border-destructive"            
    ),
    {
        variants: {
            variant: {
                default:"h-control", 
                destructive: "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"               
            },
            size: {
                default: "h-control text-sm",
                sm: "h-control-sm text-sm",
                lg: "h-control-lg text-sm"
                              
            }
        }        
    }
)

function Input({ className, info, size="default", variant="default", required = false, error, label, startElement=null, endElement=null, type, ...props }) {    
  return (
    <div>
        {
            (label) &&
            <Label className="mb-1 flex flex-row items-center text-label text-muted-foreground">                
                {label}
                {
                    (info) &&
                    <Tooltip content={info}>
                        <Icon name="information-line" />
                    </Tooltip>
                }
                {required && <span className="text-xs text-destructive">*</span>}
                
            </Label>
        }
        <div className={cn(inputVariants({ variant: error ? "destructive" : variant, size, className: "" }))}>
            {
                (startElement) &&
                <div className="shrink-0 select-none text-sm text-muted-foreground">
                    {startElement}
                </div>
            }  
            <InputPrimitive
                type={type}
                data-slot="input"
                aria-invalid={!!error}
                className={cn(
                    "min-w-0 grow h-full w-full",
                    "block outline-0 text-sm",
                    "file:text-foreground placeholder:text-sm placeholder:text-muted-foreground",
                    "selection:bg-primary selection:text-primary-foreground",
                    "file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",                    
                    className

                )}                
                {...props}                
            />
            {
                (endElement) &&
                <div className="shrink-0 select-none">
                    {endElement}
                </div>
            }
        </div>
        {
            error &&
            <div className="text-destructive text-[12px]">{error}</div>
        }
    
      </div>
  );
}

function PasswordInput ({ className, label, error, startElement=null, ...props }) {

    const [ show, setShow ] = useState(false)

    return(
        <Input 
            label={label}
            className={className}
            startElement={startElement}
            type={ show ? "text" : "password"}
            error={error}
            endElement={<Icon onClick={() => setShow(!show)} name={show ? 'eye-off-fill' : 'eye-fill'} className={show ? 'text-muted-foreground mr-2' : 'text-muted-foreground/50 mr-2'} />}
            {...props}
        />
    )
}

Input.Password = PasswordInput
export { Input }
