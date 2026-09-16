"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Click-to-edit single-line text. Saves on blur/Enter when the value changed.
 *
 * @param {object} props
 * @param {string} [props.value]
 * @param {(value: string) => void} [props.onSave]
 * @param {string} [props.placeholder]
 * @param {boolean} [props.required]
 * @param {string} [props.className]
 * @param {string} [props.inputClassName]
 * @param {"h1" | "p" | "span"} [props.as]
 */
function InlineText({
  value = "",
  onSave,
  placeholder = "Click to edit",
  required = false,
  className,
  inputClassName,
  as = "span",
}) {
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(String(value ?? ""))
  const inputRef = React.useRef(null)
  const Tag = as === "h1" ? "h1" : as === "p" ? "p" : "span"

  React.useEffect(() => {
    if (!editing) {
      setDraft(String(value ?? ""))
    }
  }, [value, editing])

  React.useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const commit = () => {
    const next = draft.trim()

    if (required && next === "") {
      setDraft(String(value ?? ""))
      setEditing(false)
      return
    }

    setEditing(false)

    if (next !== String(value ?? "").trim()) {
      onSave?.(next)
    }
  }

  const cancel = () => {
    setDraft(String(value ?? ""))
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            commit()
          }
          if (event.key === "Escape") {
            event.preventDefault()
            cancel()
          }
        }}
        placeholder={placeholder}
        className={cn(
          "w-full min-w-0 rounded-sm border border-input bg-transparent px-1.5 py-0.5 outline-none",
          "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40",
          inputClassName,
          className
        )}
      />
    )
  }

  return (
    <Tag
      role="button"
      tabIndex={0}
      title="Click to edit"
      className={cn(
        "cursor-text rounded-sm px-1.5 py-0.5 outline-none transition-colors",
        "hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/40",
        !value && "text-muted-foreground",
        className
      )}
      onClick={() => setEditing(true)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          setEditing(true)
        }
      }}
    >
      {value || placeholder}
    </Tag>
  )
}

/**
 * Click-to-edit multiline text.
 *
 * @param {object} props
 * @param {string} [props.value]
 * @param {(value: string) => void} [props.onSave]
 * @param {string} [props.placeholder]
 * @param {string} [props.className]
 * @param {string} [props.textareaClassName]
 * @param {number} [props.rows]
 */
function InlineTextarea({
  value = "",
  onSave,
  placeholder = "Click to edit",
  className,
  textareaClassName,
  rows = 3,
}) {
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(String(value ?? ""))
  const ref = React.useRef(null)

  React.useEffect(() => {
    if (!editing) {
      setDraft(String(value ?? ""))
    }
  }, [value, editing])

  React.useEffect(() => {
    if (editing) {
      ref.current?.focus()
    }
  }, [editing])

  const commit = () => {
    const next = draft.trim()
    setEditing(false)

    if (next !== String(value ?? "").trim()) {
      onSave?.(next)
    }
  }

  const cancel = () => {
    setDraft(String(value ?? ""))
    setEditing(false)
  }

  if (editing) {
    return (
      <textarea
        ref={ref}
        value={draft}
        rows={rows}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault()
            cancel()
          }
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault()
            commit()
          }
        }}
        placeholder={placeholder}
        className={cn(
          "w-full rounded-md border border-input bg-transparent px-2.5 py-2 text-sm outline-none",
          "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40",
          "dark:bg-input/30",
          textareaClassName,
          className
        )}
      />
    )
  }

  return (
    <button
      type="button"
      title="Click to edit"
      className={cn(
        "w-full rounded-md px-2.5 py-2 text-left text-sm transition-colors",
        "hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
        !value && "text-muted-foreground",
        className
      )}
      onClick={() => setEditing(true)}
    >
      {value ? (
        <span className="whitespace-pre-wrap">{value}</span>
      ) : (
        placeholder
      )}
    </button>
  )
}

export { InlineText, InlineTextarea }
