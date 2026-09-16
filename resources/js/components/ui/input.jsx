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
    "h-9 border outline-0 px-3 py-1 pr-0 text-base shadow-xs transition-[color,box-shadow]",
    "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
    "has-[input:focus-within]:border-ring  has-[input:focus-within]:ring-ring/50 has-[input:focus-within]:ring-[1px]",
    "has-[input[aria-invalid='true']]:ring-destructive/20 dark:has-[input[aria-invalid='true']]:ring-destructive/40 has-[input[aria-invalid='true']]:border-destructive"            
    ),
    {
        variants: {
            variant: {
                default:"h-9", 
                destructive: "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"               
            },
            size: {
                default: "h-9 text-base",
                sm: "h-8 text-sm",
                lg: "h-11 text-base"
                              
            }
        }        
    }
)

function Input({ className, info, size="default", variant="default", required = false, error, label, startElement=null, endElement=null, type, ...props }) {    
  return (
    <div>
        {
            (label) &&
            <Label className="text-base mb-0.5 flex flex-row text-muted-foreground items-center">                
                {label}
                {
                    (info) &&
                    <Tooltip content={info}>
                        <Icon name="information-line" />
                    </Tooltip>
                }
                {required && <span className="text-sm text-destructive">*</span>}
                
            </Label>
        }
        <div className={cn(inputVariants({ variant: error ? "destructive" : variant, size, className: "" }))}>
            {
                (startElement) &&
                <div className="shrink-0 select-none text-base text-muted-foreground">
                    {startElement}
                </div>
            }  
            <InputPrimitive
                type={type}
                data-slot="input"
                aria-invalid={!!error}
                // className={cn(
                //     "h-9 w-full min-w-0 rounded-sm border border-input bg-transparent px-2.5 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
                //     className
                // )}
                                
                className={cn(
                    "min-w-0 grow h-full w-full",
                    "block outline-0 text-base",
                    "file:text-foreground placeholder:text-base placeholder:text-muted-foreground",
                    "selection:bg-primary selection:text-primary-foreground",
                    "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",                    
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
            <div className="text-destructive text-[13px]">{error}</div>
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
