"use client"

import { ComboBox } from "@/components/ui/combo-box"
import { useMeta } from "@/hooks/use-meta"

/**
 * Autocomplete input backed by shared tenant meta_data values.
 * Suggestions come from shared props; new values are remembered by the
 * backend on form submit via MetaData::remember().
 *
 * @param {object} props
 * @param {string} props.metaType CITY | COUNTRY | PROJECT | UNIT | AREA | LINK | DEPARTMENT | UNIT_CATEGORY
 * @param {string[]} [props.options] Optional override; defaults to useMeta(metaType)
 * @param {string | null | undefined} [props.value]
 * @param {(value: string) => void} [props.onValueChange]
 */
function MetaComboBox({ metaType, options, ...props }) {
  const sharedOptions = useMeta(metaType)

  return (
    <ComboBox
      {...props}
      options={options ?? sharedOptions}
    />
  )
}

export { MetaComboBox }
