"use client"

import Markdown from "react-markdown"

import { cn } from "@/lib/utils"

/**
 * Renders Markdown stored in the database (e.g. project description).
 *
 * @param {object} props
 * @param {string | null | undefined} props.content
 * @param {string} [props.className]
 */
function MarkdownContent({ content, className }) {
  const markdown = String(content || "").trim()

  if (!markdown) {
    return null
  }

  return (
    <div
      className={cn(
        "max-w-none text-sm leading-relaxed text-foreground/85",
        "[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
        "[&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground",
        "[&_h2:first-child]:mt-0",
        "[&_h3]:mt-4 [&_h3]:mb-1.5 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground",
        "[&_h3:first-child]:mt-0",
        "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
        "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
        "[&_li]:my-0.5",
        "[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
        "[&_hr]:my-4 [&_hr]:border-border",
        "[&_img]:my-3 [&_img]:max-h-[28rem] [&_img]:w-auto [&_img]:max-w-full [&_img]:rounded-md [&_img]:border [&_img]:border-border",
        "[&_strong]:font-semibold [&_strong]:text-foreground",
        "[&_em]:italic",
        "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
        "[&_code]:rounded-sm [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs",
        className
      )}
    >
      <Markdown
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
          img: ({ src, alt }) => (
            <img src={src} alt={alt || ""} loading="lazy" />
          ),
        }}
      >
        {markdown}
      </Markdown>
    </div>
  )
}

export { MarkdownContent }
