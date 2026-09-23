import { useEffect, useRef, useState } from "react"
import { card } from "@/routes/portal/contacts"
import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { formatMoney } from "@/lib/currency"
import { cn } from "@/lib/utils"
import { pathFrom, requestJson } from "./notifications-helpers"

/** @type {Map<string, object>} */
const contactCardCache = new Map()

export function invalidateContactCardCache(uuid) {
  if (uuid) {
    contactCardCache.delete(uuid)
  }
}

export function getCachedContactCard(uuid) {
  return uuid ? contactCardCache.get(uuid) || null : null
}

export function primeContactCardCache(contact) {
  if (contact?.uuid) {
    contactCardCache.set(contact.uuid, contact)
  }
}

function titleCaseLabel(value) {
  return String(value || "")
    .toLowerCase()
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function contactLocationLabel(contact) {
  return [contact?.city, contact?.country].filter(Boolean).join(", ") || null
}

function ContactCardSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-4">
      <div className="flex items-start gap-3">
        <div className="size-12 shrink-0 rounded-full bg-muted" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-5 w-2/3 rounded bg-muted" />
          <div className="h-3 w-1/2 rounded bg-muted" />
          <div className="flex gap-1.5 pt-1">
            <div className="h-5 w-14 rounded-full bg-muted" />
            <div className="h-5 w-16 rounded-full bg-muted" />
          </div>
        </div>
      </div>
      <div className="space-y-2 border-t border-border pt-3">
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-4/5 rounded bg-muted" />
        <div className="h-3 w-3/5 rounded bg-muted" />
      </div>
    </div>
  )
}

function ContactInfoRow({ icon, label, children, className }) {
  if (!children) {
    return null
  }

  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      <Icon
        name={icon}
        className="mt-0.5 shrink-0 text-base text-muted-foreground"
      />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="break-words text-sm text-foreground">{children}</div>
      </div>
    </div>
  )
}

/**
 * Contact summary card used in popovers and previews.
 *
 * @param {object} props
 * @param {object} props.contact
 * @param {"interactive" | "preview"} [props.mode]
 * @param {"summary" | "full"} [props.detailLevel]
 * @param {string} [props.className]
 */
export function ContactCard({
  contact,
  mode = "preview",
  detailLevel = "summary",
  className,
}) {
  const name = contact.display_name || "Contact"
  const location = contactLocationLabel(contact)
  const interactive = mode === "interactive"
  const full = detailLevel === "full"

  return (
    <article
      className={cn(
        "relative flex flex-col bg-card p-4",
        full ? "gap-5" : "gap-4",
        interactive &&
          "rounded-md border border-border/80 transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:shadow-[0_16px_48px_-16px_rgba(0,0,0,0.14)]",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar name={name} className="size-12" textClass="text-sm" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold tracking-tight text-foreground">
              {name}
            </div>
            {contact.reference ? (
              <div className="mt-0.5 truncate text-sm text-muted-foreground">
                {contact.reference}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {contact.type ? (
              <Badge variant="outline" className="rounded-sm font-normal">
                {titleCaseLabel(contact.type)}
              </Badge>
            ) : null}
            {contact.tag ? (
              <Badge variant="secondary" className="rounded-sm font-normal">
                {titleCaseLabel(contact.tag)}
              </Badge>
            ) : null}
            {full && contact.contact_preference ? (
              <Badge variant="outline" className="rounded-sm font-normal">
                Prefers {titleCaseLabel(contact.contact_preference)}
              </Badge>
            ) : null}
          </div>
        </div>
      </div>

      <div
        className={cn(
          "border-t border-border",
          full ? "grid gap-x-4 gap-y-4 pt-5 sm:grid-cols-2" : "space-y-2.5 pt-3"
        )}
      >
        <ContactInfoRow icon="phone-line" label="Phone">
          {contact.phone_number}
        </ContactInfoRow>
        {full ? (
          <ContactInfoRow icon="phone-find-line" label="Alt phone">
            {contact.phone_number_alt}
          </ContactInfoRow>
        ) : null}
        <ContactInfoRow icon="mail-line" label="Email">
          {contact.email_address}
        </ContactInfoRow>
        <ContactInfoRow icon="map-pin-line" label="Location">
          {location}
        </ContactInfoRow>
        {!full ? (
          <ContactInfoRow icon="chat-1-line" label="Preference">
            {contact.contact_preference
              ? titleCaseLabel(contact.contact_preference)
              : null}
          </ContactInfoRow>
        ) : null}
        {full ? (
          <>
            <ContactInfoRow icon="bank-card-line" label="CNIC">
              {contact.cnic}
            </ContactInfoRow>
            <ContactInfoRow
              icon="money-dollar-circle-line"
              label="Income"
            >
              {contact.income_level
                ? titleCaseLabel(contact.income_level)
                : null}
            </ContactInfoRow>
            <ContactInfoRow icon="wallet-3-line" label="Affordability">
              {contact.affordability
                ? titleCaseLabel(contact.affordability)
                : null}
            </ContactInfoRow>
            <ContactInfoRow icon="flashlight-line" label="Capability">
              {contact.capability
                ? titleCaseLabel(contact.capability)
                : null}
            </ContactInfoRow>
            <ContactInfoRow icon="funds-line" label="Net worth">
              {contact.net_worth != null
                ? formatMoney(contact.net_worth)
                : null}
            </ContactInfoRow>
            <ContactInfoRow
              icon="home-4-line"
              label="Address"
              className="sm:col-span-2"
            >
              {contact.address}
            </ContactInfoRow>
            <ContactInfoRow
              icon="flag-line"
              label="Goal"
              className="sm:col-span-2"
            >
              {contact.goal}
            </ContactInfoRow>
          </>
        ) : null}
      </div>

      <div
        className={cn(
          "flex items-center gap-3 border-t border-border text-xs text-muted-foreground",
          full ? "pt-5" : "pt-3"
        )}
      >
        <span>
          {contact.leads_count ?? 0} lead
          {(contact.leads_count ?? 0) === 1 ? "" : "s"}
        </span>
        {!full && contact.income_level ? (
          <>
            <span>·</span>
            <span>{titleCaseLabel(contact.income_level)} income</span>
          </>
        ) : null}
        {!full && contact.affordability ? (
          <>
            <span>·</span>
            <span>{titleCaseLabel(contact.affordability)}</span>
          </>
        ) : null}
      </div>
    </article>
  )
}

/**
 * Click popover that lazy-loads a contact card.
 *
 * @param {object} props
 * @param {object | null | undefined} props.contact Lean contact ({ uuid, display_name? })
 * @param {import("react").ReactNode} props.children Trigger content (e.g. info icon)
 * @param {string} [props.align]
 * @param {string} [props.className]
 * @param {string} [props.ariaLabel]
 * @param {(contact: object) => void} [props.onEdit]
 * @param {boolean} [props.editDisabled]
 */
export function ContactCardPopover({
  contact,
  children,
  align = "start",
  className,
  ariaLabel = "Contact details",
  onEdit,
  editDisabled = false,
}) {
  const [open, setOpen] = useState(false)
  const [showFullDetails, setShowFullDetails] = useState(false)
  const [details, setDetails] = useState(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const requestKey = useRef(null)

  useEffect(() => {
    if (!open) {
      setShowFullDetails(false)
      return undefined
    }

    if (!contact?.uuid) {
      return undefined
    }

    const uuid = contact.uuid
    const cached = contactCardCache.get(uuid)

    if (cached) {
      setDetails(cached)
      setFailed(false)
      setLoading(false)
      return undefined
    }

    let cancelled = false
    requestKey.current = uuid
    setLoading(true)
    setFailed(false)

    requestJson(pathFrom(card.url(uuid)))
      .then((payload) => {
        if (cancelled || requestKey.current !== uuid) {
          return
        }

        const next = payload?.data || payload

        if (!next?.uuid) {
          throw new Error("Invalid contact card payload")
        }

        contactCardCache.set(uuid, next)
        setDetails(next)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled || requestKey.current !== uuid) {
          return
        }

        setFailed(true)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, contact?.uuid])

  if (!contact?.uuid) {
    return children
  }

  const cardContact = details || contact
  const canEdit =
    Boolean(details?.uuid) &&
    typeof onEdit === "function" &&
    !editDisabled
  const canToggleDetails = Boolean(details?.uuid) && !loading && !failed

  const handleEdit = () => {
    if (!canEdit) {
      return
    }

    setOpen(false)
    onEdit(details)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none",
          "transition-colors hover:bg-muted hover:text-foreground",
          "focus-visible:ring-2 focus-visible:ring-ring/50",
          "data-popup-open:bg-muted data-popup-open:text-foreground",
          className
        )}
        aria-label={ariaLabel}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent
        align={align}
        side="bottom"
        sideOffset={8}
        className={cn(
          "gap-0 overflow-hidden p-0 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.28)] ring-1 ring-foreground/10 dark:shadow-[0_18px_50px_-12px_rgba(0,0,0,0.55)]",
          showFullDetails ? "w-[26rem]" : "w-[22rem]"
        )}
      >
        <div
          className={cn(
            showFullDetails && "max-h-[min(70vh,32rem)] overflow-y-auto"
          )}
        >
          {loading && !details ? (
            <ContactCardSkeleton />
          ) : failed && !details ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <Icon
                name="error-warning-line"
                className="text-2xl text-muted-foreground"
              />
              <p className="text-sm text-muted-foreground">
                Unable to load contact
              </p>
            </div>
          ) : (
            <ContactCard
              contact={cardContact}
              mode="preview"
              detailLevel={showFullDetails ? "full" : "summary"}
            />
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-border bg-card px-3 py-2.5">
          {typeof onEdit === "function" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={!canEdit}
              onClick={(event) => {
                event.stopPropagation()
                handleEdit()
              }}
            >
              <Icon name="pencil-line" className="text-base" />
              Edit
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="flex-1"
            disabled={!canToggleDetails}
            onClick={(event) => {
              event.stopPropagation()
              setShowFullDetails((current) => !current)
            }}
          >
            <Icon
              name={showFullDetails ? "arrow-up-s-line" : "file-info-line"}
              className="text-base"
            />
            {showFullDetails ? "Hide details" : "View details"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
