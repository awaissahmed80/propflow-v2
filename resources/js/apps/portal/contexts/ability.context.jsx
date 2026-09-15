import { useEffect, createContext, useState } from "react";
import {  AbilityBuilder, createMongoAbility } from '@casl/ability'
import { useAuth } from "@/hooks/use-auth";


export const AbilityContext = createContext();

export const AbilityProvider = ({children}) => {
    
    const [ability] = useState(() => createMongoAbility([])) // persistent reference
    const { user } = useAuth();

    const defineAbilityFor = (permissions = []) => {

        const { can, rules } = new AbilityBuilder(createMongoAbility)
        // console.log("Permissions", permissions)
        permissions.forEach(permission => {
            const [action, ...subjectParts] = permission.split(' ')
            const subject = subjectParts.join(' ') || 'all'
            can(action, subject)
        })

        return rules
    }

    useEffect(() => {
        if(user?.permissions?.length > 0){
            const userAbility = defineAbilityFor(user?.permissions)
            ability.update(userAbility)
        }
    }, [user?.permissions, ability])

    

    return(     
        <AbilityContext.Provider value={ability}>
            {children}
        </AbilityContext.Provider>    
    )

}