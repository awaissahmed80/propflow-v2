import { useEffect, useRef, useState } from "react"
import { Icon } from "@/components/ui/icon"
import { cn } from "@/lib/utils"

/**
 * @param {{ name?: string, type?: string | null, kind?: string, url?: string }} file
 */
export function isVoiceNoteFile(file) {
  const mime = String(file?.type || "").toLowerCase()
  const extension = String(file?.name || "")
    .split(".")
    .pop()
    ?.toLowerCase()

  return (
    mime.startsWith("audio/") ||
    ["webm", "mp3", "ogg", "wav", "m4a", "mpeg"].includes(extension || "")
  )
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00"
  }

  const total = Math.floor(seconds)
  const mins = Math.floor(total / 60)
  const secs = String(total % 60).padStart(2, "0")

  return `${mins}:${secs}`
}

/**
 * WhatsApp-style inline voice note player for timelines and composers.
 *
 * @param {object} props
 * @param {string} props.src
 * @param {string} [props.name]
 * @param {string} [props.className]
 */
export function VoiceNotePlayer({ src, name = "Voice note", className }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    setPlaying(false)
    setDuration(0)
    setCurrent(0)
  }, [src])

  useEffect(() => {
    const audio = audioRef.current

    if (!audio) {
      return undefined
    }

    const onLoaded = () => {
      if (Number.isFinite(audio.duration)) {
        setDuration(audio.duration)
      }
    }
    const onTime = () => setCurrent(audio.currentTime || 0)
    const onEnded = () => {
      setPlaying(false)
      setCurrent(0)
    }
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)

    audio.addEventListener("loadedmetadata", onLoaded)
    audio.addEventListener("durationchange", onLoaded)
    audio.addEventListener("timeupdate", onTime)
    audio.addEventListener("ended", onEnded)
    audio.addEventListener("play", onPlay)
    audio.addEventListener("pause", onPause)

    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded)
      audio.removeEventListener("durationchange", onLoaded)
      audio.removeEventListener("timeupdate", onTime)
      audio.removeEventListener("ended", onEnded)
      audio.removeEventListener("play", onPlay)
      audio.removeEventListener("pause", onPause)
    }
  }, [src])

  const progress = duration > 0 ? Math.min(1, current / duration) : 0
  const bars = 28

  const toggle = async () => {
    const audio = audioRef.current

    if (!audio) {
      return
    }

    if (audio.paused) {
      try {
        await audio.play()
      } catch {
        // Autoplay / decode errors — ignore.
      }
    } else {
      audio.pause()
    }
  }

  const seek = (event) => {
    const audio = audioRef.current
    const track = event.currentTarget

    if (!audio || !duration) {
      return
    }

    const rect = track.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    audio.currentTime = ratio * duration
    setCurrent(audio.currentTime)
  }

  return (
    <div
      className={cn(
        "flex w-full max-w-sm items-center gap-2.5 rounded-2xl rounded-bl-md bg-primary/10 px-2.5 py-2",
        className,
      )}
    >
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      <button
        type="button"
        aria-label={playing ? `Pause ${name}` : `Play ${name}`}
        onClick={toggle}
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform hover:scale-105"
      >
        <Icon name={playing ? "pause-fill" : "play-fill"} className="text-lg" />
      </button>

      <div className="min-w-0 flex-1 space-y-1">
        <button
          type="button"
          aria-label="Seek"
          className="flex h-6 w-full cursor-pointer items-end gap-px"
          onClick={seek}
        >
          {Array.from({ length: bars }, (_, index) => {
            const threshold = (index + 1) / bars
            const active = progress >= threshold
            const height = 30 + ((index * 37) % 70)

            return (
              <span
                key={index}
                className={cn(
                  "min-w-0 flex-1 rounded-full transition-colors",
                  active ? "bg-primary" : "bg-primary/30",
                )}
                style={{ height: `${height}%` }}
              />
            )
          })}
        </button>
        <div className="flex items-center justify-between gap-2 text-[11px] tabular-nums text-muted-foreground">
          <span>{formatTime(playing || current > 0 ? current : duration)}</span>
          <Icon name="mic-fill" className="text-xs text-primary/70" />
        </div>
      </div>
    </div>
  )
}
