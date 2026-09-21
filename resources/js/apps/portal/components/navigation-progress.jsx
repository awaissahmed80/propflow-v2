import { router } from "@inertiajs/react"
import { useEffect, useState } from "react"

/**
 * Top progress bar that starts when a visit is accepted, before the page
 * component or response arrives.
 */
export function NavigationProgress() {
  const [phase, setPhase] = useState("idle")

  useEffect(() => {
    let activeKey = null
    let hideTimer = 0

    const visitKey = (visit) => {
      const url = visit.url
      const href = typeof url === "string" ? url : url?.href

      return `${visit.method || "get"}:${href || ""}`
    }

    const begin = (visit) => {
      window.clearTimeout(hideTimer)
      activeKey = visitKey(visit)
      setPhase("loading")
    }

    const end = (visit) => {
      if (visitKey(visit) !== activeKey || visit.interrupted) {
        return
      }

      activeKey = null
      setPhase("done")
      hideTimer = window.setTimeout(() => {
        setPhase("idle")
      }, 220)
    }

    const shouldTrack = (visit) => {
      return Boolean(visit) && visit.prefetch !== true && visit.showProgress !== false
    }

    const removeBefore = router.on("before", (event) => {
      const visit = event.detail?.visit

      if (!shouldTrack(visit)) {
        return
      }

      queueMicrotask(() => {
        if (!event.defaultPrevented) {
          begin(visit)
        }
      })
    })

    const removeFinish = router.on("finish", (event) => {
      const visit = event.detail?.visit

      if (!shouldTrack(visit)) {
        return
      }

      end(visit)
    })

    return () => {
      window.clearTimeout(hideTimer)
      removeBefore()
      removeFinish()
    }
  }, [])

  if (phase === "idle") {
    return null
  }

  return (
    <div
      className="nav-progress"
      data-state={phase}
      role="progressbar"
      aria-hidden="true"
    />
  )
}
