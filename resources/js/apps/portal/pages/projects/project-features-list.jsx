export function FeaturesList({ features, onEdit }) {
    if (features.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                No features listed yet. Add amenities and highlights for this project.
            </p>
        );
    }

    return (
        <ul className="space-y-1">
            {features.map((feature, index) => (
                <li key={`${index}-${feature}`}>
                    <button
                        type="button"
                        className="group flex w-full items-start gap-2 rounded-md px-1 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted/40"
                        onClick={() => onEdit({ index, value: feature })}
                    >
                        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                        <span className="min-w-0 flex-1">{feature}</span>
                    </button>
                </li>
            ))}
        </ul>
    );
}
