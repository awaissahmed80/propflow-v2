"use client"

import { useEffect } from "react"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import Link from "@tiptap/extension-link"
import Image from "@tiptap/extension-image"
import { Markdown } from "tiptap-markdown"
import {
  BoldIcon,
  ItalicIcon,
  ListIcon,
  ListOrderedIcon,
  LinkIcon,
  StrikethroughIcon,
  Heading2Icon,
  Heading3Icon,
  QuoteIcon,
  MinusIcon,
  ImageIcon,
  CodeIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

/**
 * @param {object} props
 * @param {import("@tiptap/react").Editor | null} props.editor
 * @param {boolean} props.active
 * @param {() => void} props.onClick
 * @param {import("react").ReactNode} props.children
 * @param {string} [props.label]
 */
function ToolbarButton({ editor, active, onClick, children, label }) {
  return (
    <Button
      type="button"
      size="smicon"
      variant={active ? "secondary" : "ghost"}
      disabled={!editor}
      aria-label={label}
      aria-pressed={active}
      className="size-7"
      onMouseDown={(event) => {
        event.preventDefault()
        onClick()
      }}
    >
      {children}
    </Button>
  )
}

function ToolbarDivider() {
  return <span className="mx-0.5 h-4 w-px shrink-0 bg-border" aria-hidden />
}

/**
 * Minimal Tiptap editor that reads/writes Markdown for form fields.
 *
 * @param {object} props
 * @param {string} [props.label]
 * @param {string | null | undefined} [props.value]
 * @param {(value: string) => void} [props.onChange]
 * @param {(event: { type: string }) => void} [props.onBlur]
 * @param {string} [props.placeholder]
 * @param {boolean} [props.disabled]
 * @param {string} [props.error]
 * @param {string} [props.className]
 * @param {string} [props.id]
 */
function MarkdownEditor({
  label,
  value = "",
  onChange,
  onBlur,
  placeholder = "Write something…",
  disabled = false,
  error,
  className,
  id,
}) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          class: "text-primary underline underline-offset-2",
        },
      }),
      Image.configure({
        allowBase64: false,
        HTMLAttributes: {
          class: "max-h-64 max-w-full rounded-md",
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        id: id || undefined,
        class: cn(
          "prose-editor min-h-28 max-h-64 w-full overflow-y-auto px-2.5 py-2 text-sm outline-none",
          "[&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
          "[&_h2]:my-2 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:my-1.5 [&_h3]:text-sm [&_h3]:font-semibold",
          "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
          "[&_hr]:my-3 [&_hr]:border-border",
          "[&_img]:my-2 [&_img]:max-h-64 [&_img]:max-w-full [&_img]:rounded-md",
          "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
          "[&_strong]:font-semibold [&_em]:italic [&_s]:line-through",
          "[&_code]:rounded-sm [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs",
          "[&_.is-editor-empty:first-child::before]:pointer-events-none [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 [&_.is-editor-empty:first-child::before]:text-muted-foreground [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]"
        ),
      },
    },
    onUpdate: ({ editor: current }) => {
      onChange?.(current.storage.markdown.getMarkdown())
    },
    onBlur: () => {
      onBlur?.({ type: "blur" })
    },
  })

  useEffect(() => {
    if (!editor) {
      return
    }

    const current = editor.storage.markdown.getMarkdown()
    const next = value ?? ""

    if (current === next) {
      return
    }

    editor.commands.setContent(next)
  }, [editor, value])

  useEffect(() => {
    if (!editor) {
      return
    }

    editor.setEditable(!disabled)
  }, [editor, disabled])

  const setLink = () => {
    if (!editor) {
      return
    }

    const previous = editor.getAttributes("link").href
    const url = window.prompt("Link URL", previous || "https://")

    if (url === null) {
      return
    }

    if (url.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
      return
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run()
  }

  const setImage = () => {
    if (!editor) {
      return
    }

    const url = window.prompt("Image URL", "https://")

    if (url === null || url.trim() === "") {
      return
    }

    editor.chain().focus().setImage({ src: url.trim() }).run()
  }

  return (
    <div className={cn("w-full space-y-0.5", className)}>
      {label ? (
        <Label
          htmlFor={id}
          className="mb-1 flex flex-row items-center text-label font-medium text-muted-foreground"
        >
          {label}
        </Label>
      ) : null}

      <div
        className={cn(
          "overflow-hidden rounded-md border border-input bg-transparent shadow-xs transition-[color,box-shadow] dark:bg-input/30",
          "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
          error &&
            "border-destructive ring-destructive/20 dark:ring-destructive/40",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <div className="flex flex-wrap items-center gap-0.5 border-b border-border/70 px-1.5 py-1">
          <ToolbarButton
            editor={editor}
            label="Bold"
            active={Boolean(editor?.isActive("bold"))}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <BoldIcon className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            editor={editor}
            label="Italic"
            active={Boolean(editor?.isActive("italic"))}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            <ItalicIcon className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            editor={editor}
            label="Strikethrough"
            active={Boolean(editor?.isActive("strike"))}
            onClick={() => editor?.chain().focus().toggleStrike().run()}
          >
            <StrikethroughIcon className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            editor={editor}
            label="Inline code"
            active={Boolean(editor?.isActive("code"))}
            onClick={() => editor?.chain().focus().toggleCode().run()}
          >
            <CodeIcon className="size-3.5" />
          </ToolbarButton>

          <ToolbarDivider />

          <ToolbarButton
            editor={editor}
            label="Heading 2"
            active={Boolean(editor?.isActive("heading", { level: 2 }))}
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 2 }).run()
            }
          >
            <Heading2Icon className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            editor={editor}
            label="Heading 3"
            active={Boolean(editor?.isActive("heading", { level: 3 }))}
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 3 }).run()
            }
          >
            <Heading3Icon className="size-3.5" />
          </ToolbarButton>

          <ToolbarDivider />

          <ToolbarButton
            editor={editor}
            label="Bullet list"
            active={Boolean(editor?.isActive("bulletList"))}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          >
            <ListIcon className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            editor={editor}
            label="Numbered list"
            active={Boolean(editor?.isActive("orderedList"))}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          >
            <ListOrderedIcon className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            editor={editor}
            label="Quote"
            active={Boolean(editor?.isActive("blockquote"))}
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          >
            <QuoteIcon className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            editor={editor}
            label="Divider"
            active={false}
            onClick={() => editor?.chain().focus().setHorizontalRule().run()}
          >
            <MinusIcon className="size-3.5" />
          </ToolbarButton>

          <ToolbarDivider />

          <ToolbarButton
            editor={editor}
            label="Link"
            active={Boolean(editor?.isActive("link"))}
            onClick={setLink}
          >
            <LinkIcon className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            editor={editor}
            label="Image"
            active={Boolean(editor?.isActive("image"))}
            onClick={setImage}
          >
            <ImageIcon className="size-3.5" />
          </ToolbarButton>
        </div>

        <EditorContent editor={editor} />
      </div>

      {error ? <div className="text-[13px] text-destructive">{error}</div> : null}
    </div>
  )
}

export { MarkdownEditor }
