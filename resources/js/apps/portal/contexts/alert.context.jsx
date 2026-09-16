import { useState, createContext } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button";

const initialState = {
    open: false,     
    title: 'Alert',
    message: '',
    type: 'alert'
};

let resolveCallback = (val) => {
    return val;
}

const AlertContext = createContext({
    ...initialState,
    init: () => Promise.resolve(),
    show: () => Promise.resolve(),     
    hide: () => Promise.resolve()
});


export const AlertProvider = ({children}) => {

    const [state, setState] = useState(initialState)

    const show = (title=initialState.title, message="") => {
        setState({...state, open: true, title, message})
    }

    const alert = (message="", title=initialState.title) => {
        setState({...state, open: true, type: 'alert', title, message})
    }

    const onConfirm = () => {
        setState({...state, open: false})
        resolveCallback(true);
    };

    const onCancel = () => {
        setState({...state, open: false})
        resolveCallback(false);
    };

    const confirm = (message="", title='Confirm') => {
        setState({...state, open: true, type: 'confirm', title, message})
        return new Promise((resolve) => {
            return resolveCallback = resolve;
        })
    }
    
    const hide = () => {
        setState({...state, open: false})
        return false;
    }

    const setAlert = () => {                        
        window.alert = alert
        window.confirm = confirm    
    }

    return (
        <AlertContext.Provider value={{show, hide, alert}}>
            <AlertDialog open={state.open} onOpenChange={() => hide()}>
                <AlertDialogContent className="fixed left-1/2 border-border/50 top-25 z-50 w-full transition-all duration-300  -translate-x-1/2 transform">
                    <AlertDialogHeader>
                        <AlertDialogTitle> {state.title}</AlertDialogTitle>
                        <AlertDialogDescription> {state.message}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="pt-3">
                        {
                            (state?.type === 'alert') ?
                            <>
                                <Button variant="destructive" type="button" onClick={hide}>Continue</Button>                                
                            </>
                            :
                            <>
                                <AlertDialogCancel type="button" onClick={onCancel}>No</AlertDialogCancel>
                                <AlertDialogAction onClick={onConfirm} className="bg-destructive hover:bg-destructive/80">Yes</AlertDialogAction>
                            </>
                        }
                        
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            {children}
            {setAlert()}
        </AlertContext.Provider>
    )
}