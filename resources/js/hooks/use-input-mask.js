import { useLayoutEffect, useRef } from "react"
import textMaskCore from "text-mask-core"

const createTextMaskInputElement =
  textMaskCore?.createTextMaskInputElement ??
  textMaskCore?.default?.createTextMaskInputElement ??
  textMaskCore

/**
 * Compatible reimplementation of `use-input-mask` for Vite + React 19.
 * The published package mixes ESM React imports with CJS `require()`, which
 * can load a second React copy and trigger "Invalid hook call".
 *
 * @param {{
 *   input: React.RefObject<HTMLInputElement | null>,
 *   mask: Array<string|RegExp> | ((value: string) => Array<string|RegExp>),
 *   onChange?: (event: Event) => void,
 *   guide?: boolean,
 *   keepCharPositions?: boolean,
 *   pipe?: Function,
 *   placeholderChar?: string,
 *   showMask?: boolean,
 *   initialValue?: string,
 * }} options
 */
export default function useInputMask({
  input: inputRef,
  mask,
  onChange,
  guide,
  keepCharPositions,
  pipe,
  placeholderChar,
  showMask,
  initialValue = "",
}) {
  const textMaskRef = useRef(null)

  useLayoutEffect(() => {
    if (!inputRef.current || typeof createTextMaskInputElement !== "function") {
      return
    }

    textMaskRef.current = createTextMaskInputElement({
      guide,
      inputElement: inputRef.current,
      keepCharPositions,
      mask,
      pipe,
      placeholderChar,
      showMask,
    })

    textMaskRef.current.update(initialValue)
  }, [
    inputRef,
    guide,
    keepCharPositions,
    mask,
    pipe,
    placeholderChar,
    showMask,
    initialValue,
  ])

  return (event) => {
    if (textMaskRef.current) {
      textMaskRef.current.update()
    }

    if (typeof onChange === "function") {
      onChange(event)
    }
  }
}
