import { Toaster } from "@/components/ui/sonner"
import { useAppearance } from "@/hooks/use-appearance"

export default function RootLayout ({ children }) {

    const { appearance } = useAppearance()         
    return(
        <>
            {children}
            <Toaster position="top-center" theme={appearance} richColors />
        </>
    )
}