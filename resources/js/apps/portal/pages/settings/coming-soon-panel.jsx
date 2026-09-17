import { Icon } from "@/components/ui/icon";
import { SettingsSection } from "./settings-section";

export default function ComingSoonPanel({ section }) {
    return (
        <SettingsSection title={section?.label ?? "Coming soon"} icon={section?.icon || "tools-line"}>
            <div className="flex items-start gap-3 py-2">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Icon name="time-line" className="text-lg" />
                </span>
                <div>
                    <p className="text-sm font-medium text-foreground">This section is coming soon</p>
                    <p className="mt-1 max-w-md text-sm text-muted-foreground">
                        It is scaffolded in navigation and ready for a follow-up build.
                    </p>
                </div>
            </div>
        </SettingsSection>
    );
}
