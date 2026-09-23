export function SidebarSection({ title, children }) {
    return (
        <section className="space-y-2">
            <h3 className="px-1 text-sm font-bold tracking-tight text-muted-foreground">
                {title}
            </h3>
            {children}
        </section>
    );
}
