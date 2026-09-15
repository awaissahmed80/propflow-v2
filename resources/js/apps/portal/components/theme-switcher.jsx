import { useState, useEffect } from "react"
import { Icon } from "@/components/ui/icon"
import { Switch } from "@/components/ui/switch"
import { useAppearance } from "@/hooks/use-appearance"

export const ThemeSwitcher = () => {

    const { updateAppearance } = useAppearance()
    const [ darkMode, setDarkMode ] = useState(true)
    
    useEffect(() => {        
        const isDarkMode = document.documentElement.classList.contains('dark');
        setDarkMode(isDarkMode)
    }, [darkMode])

    const toggleTheme = () => {
        const isDarkMode = document.documentElement.classList.contains('dark');
        updateAppearance(isDarkMode ? 'light' : 'dark');
        setDarkMode(!isDarkMode)
    }

    return(
        <div className="flex px-2 py-2 flex-row items-center justify-between space-x-2">                    
            <Icon name={darkMode ? 'moon-fill' : 'sun-fill'} className={`text-sm`}/>
            <div className="text-sm flex-1">Dark Mode</div>
            <Switch checked={darkMode} onCheckedChange={toggleTheme} />
        </div>
    )
}