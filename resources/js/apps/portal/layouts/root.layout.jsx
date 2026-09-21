import { Toaster } from "@/components/ui/sonner"
import { useAppearance } from "@/hooks/use-appearance"
import { NavigationProgress } from "@/portal/components/navigation-progress"

export default function RootLayout({ children }) {
    const { appearance } = useAppearance()

    return (
        <>
            <NavigationProgress />
            {children}
            <Toaster position="top-center" theme={appearance} richColors />
        </>
    )
}
