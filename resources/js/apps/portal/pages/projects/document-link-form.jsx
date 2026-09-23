import { useEffect, useState } from "react"
import { router } from "@inertiajs/react"
import { useForm, Controller } from "react-hook-form"
import { toast } from "sonner"
import { update } from "@/actions/App/Http/Controllers/Portal/AssetLinkController"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"

const emptyValues = {
  label: "",
  is_secure: false,
}

/**
 * Edit per-attachment label and secure flag for a project document link.
 *
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {(open?: boolean) => void} props.onClose
 * @param {{
 *   link_id?: number,
 *   label?: string | null,
 *   is_secure?: boolean,
 *   name?: string,
 *   title?: string,
 * } | null} props.document
 * @param {() => void} [props.onSaved]
 */
export default function DocumentLinkForm({
  isOpen,
  onClose,
  document = null,
  onSaved,
}) {
  const [processing, setProcessing] = useState(false)
  const [serverErrors, setServerErrors] = useState({})
  const {
    handleSubmit,
    register,
    control,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: emptyValues,
    mode: "onSubmit",
    reValidateMode: "onChange",
  })

  const fieldError = (name) => serverErrors[name] || errors[name]?.message

  const handleClose = () => {
    reset(emptyValues)
    setServerErrors({})
    onClose(false)
  }

  useEffect(() => {
    if (!isOpen || !document) {
      return
    }

    setServerErrors({})
    reset({
      label: document.label || "",
      is_secure: Boolean(document.is_secure),
    })
  }, [isOpen, document, reset])

  const onSubmit = (values) => {
    if (!document?.link_id) {
      toast.error("Unable to update this file")
      return
    }

    setProcessing(true)
    setServerErrors({})

    router.patch(
      update.url(document.link_id),
      {
        label: values.label?.trim() || null,
        is_secure: Boolean(values.is_secure),
      },
      {
        preserveScroll: true,
        onSuccess: () => {
          toast.success("File settings updated")
          onSaved?.()
          handleClose()
        },
        onError: (errs) => {
          setServerErrors(errs || {})
          toast.error("Please fix the highlighted fields")
        },
        onFinish: () => setProcessing(false),
      }
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Icon name="settings-3-line" className="text-xl" />
            File settings
          </DialogTitle>
          <DialogDescription>
            {document?.name
              ? `Label and access for ${document.name}.`
              : "Add a label and mark this file as secure."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5"
          onSubmit={handleSubmit(onSubmit)}
        >
          <Input
            label="Label"
            placeholder="e.g. Brochure, Floor plan, Agreement"
            error={fieldError("label")}
            {...register("label")}
          />

          <Controller
            name="is_secure"
            control={control}
            render={({ field }) => (
              <div className="flex items-start justify-between gap-4 rounded-md border border-border px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Secure file</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Only users with the right access will see this file. Access
                    rules can be configured later.
                  </p>
                </div>
                <Switch
                  className="mt-0.5 shrink-0"
                  checked={Boolean(field.value)}
                  onCheckedChange={field.onChange}
                />
              </div>
            )}
          />
        </form>

        <DialogFooter className="shrink-0 border-t border-border bg-popover px-6 py-4 sm:justify-end">
          <div className="flex w-full items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={processing || !document?.link_id}
              onClick={handleSubmit(onSubmit)}
            >
              {processing ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
