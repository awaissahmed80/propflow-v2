import { useEffect, useState } from "react"
import { router } from "@inertiajs/react"
import { Modal } from "./modal"
import {
  Command,
//   CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
//   CommandSeparator,    
//   CommandShortcut,
} from "@/components/ui/command"
import { useDebounce } from "@/hooks/use-debounce"
// import { dashboardApi } from "@/store/api"
import { usePrevious } from "@/hooks/use-previous"
import { useMeta } from "@/hooks/use-meta"

export const SpotlightSearch = ({ isOpen, onClose }) => {

    // const [ getSearchResult, { data: { results = [] } = {}, isFetching }] = dashboardApi.useLazySearchQuery()
    const { projects } = useMeta()
    const [ query, setQuery ] = useState('')
    const debouncedQuery = useDebounce(query, 200)
    const prevQuery = usePrevious(debouncedQuery);
    const isFetching = false;
    const results = []
    useEffect(() => {
        if(prevQuery !== debouncedQuery) {
            if (debouncedQuery && !isFetching) {
                if(debouncedQuery?.length > 2){
                    // getSearchResult(debouncedQuery)
                } 
            }      
        }
    }, [debouncedQuery, isFetching, prevQuery])

    

    return(
        <Modal 
            isOpen={isOpen}
            onClose={onClose}
            hideTitle            
            hideClose={true}
            variant="top"
            >
            <Command shouldFilter={false} className="rounded-lg border shadow-md md:min-w-[450px]">
                <CommandInput  onValueChange={setQuery} value={query} placeholder="Search..." />
                <CommandList>
                    {/* {
                    <CommandEmpty>No results found.</CommandEmpty>
                    } */}
                    {                    
                        results.map((group, idx) => (
                            (group?.items?.length > 0) &&
                            <CommandGroup key={idx} heading={group.type}>
                                {
                                    group?.items?.map((item, i) => (
                                        <CommandItem key={i} onSelect={() => router.get(item.url)}>
                                            <span>{item.title}</span>
                                        </CommandItem>
                                    ))
                                }
                            </CommandGroup>
                        )
                    )}
                    {
                        (results?.length === 0) &&
                        <>
                            <CommandGroup heading="Suggestions">
                                <CommandItem onSelect={() => router.get('/leads')}>
                                    <span>Todo List</span>
                                </CommandItem>
                                <CommandItem onSelect={() => router.get('/projects')}>
                                    <span>Projects</span>
                                </CommandItem>
                                <CommandItem onSelect={() => router.get('/lead-ops')}>
                                    <span>Lead Ops</span>
                                </CommandItem>
                            </CommandGroup>
                            <CommandGroup heading="Projects">
                                {
                                    projects?.map((proj, p) =>
                                        <CommandItem key={p} onSelect={() => router.get(`/projects/${proj?.slug}`)}>
                                            <span>{proj.label}</span>
                                        </CommandItem>
                                    )
                                }                                                                
                            </CommandGroup>
                        </>
                    }
                </CommandList>                
            </Command>

        </Modal>
    )
}