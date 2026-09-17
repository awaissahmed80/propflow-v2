import { useEffect, useMemo, useRef, useState } from "react";
import { router } from "@inertiajs/react";
import { index } from "@/routes/portal/contacts";
import PortalLayout from "../../layouts/portal.layout";
import { Layout } from "../../components/layout";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FilterInput } from "@/components/ui/filter-input";
import {
    ActiveFilters,
    FilterMenu,
    toSelectedList,
} from "@/components/ui/filter-menu";
import { Icon } from "@/components/ui/icon";
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDateTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import ContactDetailPanel from "./contact-detail-panel";
import ContactForm from "./contact-form";

function toFilterParam(value) {
    const list = toSelectedList(value);

    return list.length > 0 ? list.join(",") : "";
}

function titleCaseLabel(value) {
    return String(value || "")
        .toLowerCase()
        .split(" ")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

/**
 * @returns {Array<number | "ellipsis">}
 */
function paginationItems(current, last) {
    if (last <= 7) {
        return Array.from({ length: last }, (_, index) => index + 1);
    }

    const items = [1];

    if (current > 3) {
        items.push("ellipsis");
    }

    const start = Math.max(2, current - 1);
    const end = Math.min(last - 1, current + 1);

    for (let page = start; page <= end; page += 1) {
        items.push(page);
    }

    if (current < last - 2) {
        items.push("ellipsis");
    }

    items.push(last);

    return items;
}

const emptyPagination = {
    current_page: 1,
    last_page: 1,
    per_page: 20,
    total: 0,
    from: null,
    to: null,
};

function ContactRow({ contact, selected = false, onOpen }) {
    const name = contact.display_name || "—";

    return (
        <tr
            role="button"
            tabIndex={0}
            onClick={() => onOpen(contact)}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpen(contact);
                }
            }}
            className={cn(
                "cursor-pointer border-b border-border last:border-0 hover:bg-muted/40",
                selected && "bg-primary/5 hover:bg-primary/10"
            )}
        >
            <td className="px-4 py-3 align-middle">
                <div className="flex min-w-0 items-center gap-3">
                    <Avatar
                        name={name}
                        size="sm"
                        className="size-8 shrink-0"
                        textClass="text-[10px]"
                    />
                    <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">
                            {name}
                        </div>
                        {contact.reference ? (
                            <div className="truncate text-xs text-muted-foreground">
                                {contact.reference}
                            </div>
                        ) : null}
                    </div>
                </div>
            </td>
            <td className="px-4 py-3 align-middle text-sm text-foreground">
                {contact.phone_number || "—"}
            </td>
            <td className="px-4 py-3 align-middle text-sm text-foreground">
                <span className="truncate">{contact.email_address || "—"}</span>
            </td>
            <td className="px-4 py-3 align-middle">
                <Badge variant="outline" className="rounded-sm font-normal">
                    {titleCaseLabel(contact.type)}
                </Badge>
            </td>
            <td className="px-4 py-3 align-middle">
                <Badge variant="secondary" className="rounded-sm font-normal">
                    {titleCaseLabel(contact.tag)}
                </Badge>
            </td>
            <td className="px-4 py-3 align-middle text-sm text-muted-foreground">
                {[contact.city, contact.country].filter(Boolean).join(", ") || "—"}
            </td>
            <td className="px-4 py-3 align-middle text-sm text-foreground">
                {contact.leads_count ?? 0}
            </td>
            <td className="px-4 py-3 align-middle text-sm text-muted-foreground">
                {formatDateTime(contact.created_at, "D MMM YYYY")}
            </td>
        </tr>
    );
}

function Contacts({
    contacts = [],
    pagination = emptyPagination,
    filters = {},
    formOptions = {},
}) {
    const [search, setSearch] = useState(filters.q || "");
    const [createOpen, setCreateOpen] = useState(false);
    const [selectedContact, setSelectedContact] = useState(null);
    const searchTimeout = useRef(null);

    const appliedFilters = useMemo(
        () => ({
            type: toSelectedList(filters.type),
            tag: toSelectedList(filters.tag),
        }),
        [filters.type, filters.tag]
    );

    useEffect(() => {
        if (!selectedContact) {
            return;
        }

        const fresh = contacts.find((contact) => contact.id === selectedContact.id);
        if (fresh) {
            setSelectedContact(fresh);
        }
    }, [contacts, selectedContact?.id]);

    const currentPage = Number(pagination.current_page) || 1;
    const lastPage = Math.max(1, Number(pagination.last_page) || 1);
    const pageItems = useMemo(
        () => paginationItems(currentPage, lastPage),
        [currentPage, lastPage]
    );

    useEffect(() => {
        setSearch(filters.q || "");
    }, [filters.q]);

    useEffect(() => {
        return () => {
            if (searchTimeout.current) {
                clearTimeout(searchTimeout.current);
            }
        };
    }, []);

    const filterSections = useMemo(() => {
        const typeOptions = (formOptions.types || []).map((value) => ({
            value,
            label: titleCaseLabel(value),
        }));

        const tagOptions = (formOptions.tags || []).map((value) => ({
            value,
            label: titleCaseLabel(value),
        }));

        return [
            { key: "type", label: "Type", options: typeOptions },
            { key: "tag", label: "Tag", options: tagOptions },
        ];
    }, [formOptions.types, formOptions.tags]);

    const visitContacts = (next = {}) => {
        const page = Object.prototype.hasOwnProperty.call(next, "page")
            ? next.page
            : currentPage;

        const params = {
            q: Object.prototype.hasOwnProperty.call(next, "q") ? next.q : search,
            type: toFilterParam(
                Object.prototype.hasOwnProperty.call(next, "type")
                    ? next.type
                    : appliedFilters.type
            ),
            tag: toFilterParam(
                Object.prototype.hasOwnProperty.call(next, "tag")
                    ? next.tag
                    : appliedFilters.tag
            ),
            page: page > 1 ? String(page) : "",
        };

        Object.keys(params).forEach((key) => {
            if (!params[key]) {
                delete params[key];
            }
        });

        router.get(index.url(), params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
            only: ["contacts", "pagination", "filters", "formOptions"],
        });
    };

    const handleSearchChange = (event) => {
        const value = event.target.value;
        setSearch(value);

        if (searchTimeout.current) {
            clearTimeout(searchTimeout.current);
        }

        searchTimeout.current = setTimeout(() => {
            visitContacts({ q: value.trim(), page: 1 });
        }, 300);
    };

    const handleFiltersApply = (next) => {
        visitContacts({
            type: next.type,
            tag: next.tag,
            page: 1,
        });
    };

    const handleFiltersClear = () => {
        visitContacts({
            type: [],
            tag: [],
            page: 1,
        });
    };

    const goToPage = (page) => {
        const nextPage = Number(page);

        if (
            !Number.isFinite(nextPage) ||
            nextPage < 1 ||
            nextPage > lastPage ||
            nextPage === currentPage
        ) {
            return;
        }

        visitContacts({ page: nextPage });
    };

    const hasFilters =
        Boolean(filters.q) ||
        appliedFilters.type.length > 0 ||
        appliedFilters.tag.length > 0;

    const rangeLabel =
        pagination.total > 0
            ? `Showing ${pagination.from}–${pagination.to} of ${pagination.total}`
            : "No results";

    return (
        <Layout>
            <Layout.Header
                metaTitle="Contacts"
                breadcrumbs={[{ label: "Contacts" }]}
            />

            <Layout.Content className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                <Layout.Toolbar className="flex-wrap">
                    <h1 className="shrink-0 text-xl font-bold tracking-tight text-foreground">
                        Contacts
                    </h1>

                    <FilterInput
                        value={search}
                        onChange={handleSearchChange}
                        placeholder="Search name, phone, email..."
                        className="w-56"
                    />

                    <FilterMenu
                        sections={filterSections}
                        value={appliedFilters}
                        onApply={handleFiltersApply}
                    />

                    <Button
                        type="button"
                        className="ml-auto shrink-0"
                        onClick={() => setCreateOpen(true)}
                    >
                        <Icon name="add-line" className="text-base" />
                        Add Contact
                    </Button>
                </Layout.Toolbar>

                <ActiveFilters
                    sections={filterSections}
                    value={appliedFilters}
                    onChange={handleFiltersApply}
                    onClear={handleFiltersClear}
                    className="shrink-0"
                />

                <ScrollArea className="min-h-0 flex-1 overflow-hidden">
                    <div className="px-6 py-6">
                        {contacts.length === 0 ? (
                            <div className="flex min-h-[22rem] flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/20 px-6 text-center">
                                <div className="mb-4 flex size-14 items-center justify-center rounded-md bg-primary/10 text-primary">
                                    <Icon name="folder-user-line" className="text-2xl" />
                                </div>
                                <h2 className="text-lg font-semibold tracking-tight">
                                    {hasFilters
                                        ? "No contacts match your filters"
                                        : "Add your first contact"}
                                </h2>
                                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                                    {hasFilters
                                        ? "Try another type, tag, or search term."
                                        : "Every lead links to a contact — keep people, phones, and emails in one place."}
                                </p>
                                {!hasFilters ? (
                                    <Button
                                        type="button"
                                        className="mt-5"
                                        onClick={() => setCreateOpen(true)}
                                    >
                                        <Icon name="add-line" className="text-base" />
                                        Create contact
                                    </Button>
                                ) : null}
                            </div>
                        ) : (
                            <div className="rounded-lg border border-border bg-card">
                                <table className="w-full min-w-[960px] text-left text-sm">
                                    <thead className="sticky top-0 z-10 border-b border-border bg-muted/40 text-muted-foreground backdrop-blur-sm">
                                        <tr>
                                            <th className="min-w-44 px-4 py-3 font-medium">
                                                Contact
                                            </th>
                                            <th className="min-w-32 px-4 py-3 font-medium">
                                                Phone
                                            </th>
                                            <th className="min-w-44 px-4 py-3 font-medium">
                                                Email
                                            </th>
                                            <th className="w-28 px-4 py-3 font-medium">
                                                Type
                                            </th>
                                            <th className="w-28 px-4 py-3 font-medium">
                                                Tag
                                            </th>
                                            <th className="min-w-32 px-4 py-3 font-medium">
                                                Location
                                            </th>
                                            <th className="w-20 px-4 py-3 font-medium">
                                                Leads
                                            </th>
                                            <th className="min-w-28 px-4 py-3 font-medium">
                                                Created
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {contacts.map((contact) => (
                                            <ContactRow
                                                key={contact.id}
                                                contact={contact}
                                                selected={
                                                    selectedContact?.id === contact.id
                                                }
                                                onOpen={setSelectedContact}
                                            />
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                {lastPage > 1 ? (
                    <div className="flex shrink-0 flex-col gap-3 border-t border-border bg-background px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-muted-foreground">{rangeLabel}</p>
                        <Pagination className="mx-0 w-auto justify-start sm:justify-end">
                            <PaginationContent>
                                <PaginationItem>
                                    <PaginationPrevious
                                        href="#"
                                        text="Prev"
                                        className={cn(
                                            currentPage <= 1 &&
                                                "pointer-events-none opacity-50"
                                        )}
                                        onClick={(event) => {
                                            event.preventDefault();
                                            goToPage(currentPage - 1);
                                        }}
                                    />
                                </PaginationItem>
                                {pageItems.map((item, index) =>
                                    item === "ellipsis" ? (
                                        <PaginationItem key={`ellipsis-${index}`}>
                                            <PaginationEllipsis />
                                        </PaginationItem>
                                    ) : (
                                        <PaginationItem key={item}>
                                            <PaginationLink
                                                href="#"
                                                isActive={item === currentPage}
                                                onClick={(event) => {
                                                    event.preventDefault();
                                                    goToPage(item);
                                                }}
                                            >
                                                {item}
                                            </PaginationLink>
                                        </PaginationItem>
                                    )
                                )}
                                <PaginationItem>
                                    <PaginationNext
                                        href="#"
                                        text="Next"
                                        className={cn(
                                            currentPage >= lastPage &&
                                                "pointer-events-none opacity-50"
                                        )}
                                        onClick={(event) => {
                                            event.preventDefault();
                                            goToPage(currentPage + 1);
                                        }}
                                    />
                                </PaginationItem>
                            </PaginationContent>
                        </Pagination>
                    </div>
                ) : null}
            </Layout.Content>

            <ContactForm
                isOpen={createOpen}
                onClose={() => setCreateOpen(false)}
                tags={formOptions.tags || []}
                types={formOptions.types || []}
                incomeLevels={formOptions.income_levels || []}
                affordabilityLevels={formOptions.affordability_levels || []}
                capabilityLevels={formOptions.capability_levels || []}
            />

            <ContactDetailPanel
                open={Boolean(selectedContact)}
                contact={selectedContact}
                types={formOptions.types || []}
                tags={formOptions.tags || []}
                incomeLevels={formOptions.income_levels || []}
                affordabilityLevels={formOptions.affordability_levels || []}
                capabilityLevels={formOptions.capability_levels || []}
                onClose={() => setSelectedContact(null)}
                onSaved={setSelectedContact}
            />
        </Layout>
    );
}

Contacts.layout = (page) => <PortalLayout children={page} />;

export default Contacts;
