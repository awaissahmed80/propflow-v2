import { Icon } from "@/components/ui/icon";
import { formatDateTime, formatRelativeTime } from "@/lib/datetime";
import { UserAvatar, UserCardPopover } from "../../components/user-card";
import { SidebarSection } from "./project-details-shared";

/**
 * @param {object} props
 * @param {object} props.project
 */
export function ProjectRecordPanel({ project }) {
    const creator = project.created_by;
    const creatorName = creator?.display_name || "Unknown";

    const creatorTrigger = (
        <span className="flex min-w-0 items-center gap-2.5 px-1.5 py-1">
            {creator ? (
                <UserAvatar user={creator} size="sm" />
            ) : (
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Icon name="user-line" className="text-sm" />
                </span>
            )}
            <span className="truncate text-sm font-medium text-foreground">
                {creatorName}
            </span>
        </span>
    );

    return (
        <SidebarSection title="Record" icon="history-line">
            <dl className="space-y-4">
                <div className="space-y-1.5">
                    <dt className="text-xs font-medium text-muted-foreground">Created by</dt>
                    <dd>
                        {creator ? (
                            <UserCardPopover user={creator} className="-ml-1.5">
                                {creatorTrigger}
                            </UserCardPopover>
                        ) : (
                            creatorTrigger
                        )}
                    </dd>
                </div>

                <div className="space-y-1">
                    <dt className="text-xs font-medium text-muted-foreground">Created</dt>
                    <dd className="text-sm text-foreground">
                        <div>{formatDateTime(project.created_at)}</div>
                        <div className="text-xs text-muted-foreground">
                            {formatRelativeTime(project.created_at)}
                        </div>
                    </dd>
                </div>

                <div className="space-y-1">
                    <dt className="text-xs font-medium text-muted-foreground">Last updated</dt>
                    <dd className="text-sm text-foreground">
                        <div>{formatDateTime(project.updated_at)}</div>
                        <div className="text-xs text-muted-foreground">
                            {formatRelativeTime(project.updated_at)}
                        </div>
                    </dd>
                </div>
            </dl>
        </SidebarSection>
    );
}
