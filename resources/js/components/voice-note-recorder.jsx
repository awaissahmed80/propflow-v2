import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Icon } from "@/components/ui/icon"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { VoiceNotePlayer } from "@/components/voice-note-player"

function preferredAudioMime() {
  if (typeof MediaRecorder === "undefined") {
    return ""
  }

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ]

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || ""
}

function extensionForMime(mime) {
  const base = String(mime || "").split(";")[0].trim().toLowerCase()

  if (base.includes("ogg")) {
    return "ogg"
  }

  if (base.includes("mp4") || base.includes("m4a")) {
    return "m4a"
  }

  if (base.includes("mpeg") || base.includes("mp3")) {
    return "mp3"
  }

  if (base.includes("wav")) {
    return "wav"
  }

  return "webm"
}

function formatElapsed(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = String(seconds % 60).padStart(2, "0")

  return `${mins}:${secs}`
}

/**
 * WhatsApp-style voice note recorder (audio only — no speech-to-text).
 *
 * @param {object} props
 * @param {boolean} [props.open]
 * @param {boolean} [props.autoStart]
 * @param {(draft: { file: File, url: string, duration: number } | null) => void} [props.onChange]
 * @param {() => void} [props.onCancel]
 * @param {string} [props.className]
 */
export function VoiceNoteRecorder({
  open = true,
  autoStart = true,
  onChange,
  onCancel,
  className,
}) {
  const [phase, setPhase] = useState("idle")
  const [audioUrl, setAudioUrl] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [levels, setLevels] = useState(() => Array.from({ length: 24 }, () => 0.2))

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const timerRef = useRef(null)
  const audioUrlRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const rafRef = useRef(null)
  const startedRef = useRef(false)
  const elapsedRef = useRef(0)

  const clearAudioUrl = () => {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
    }

    setAudioUrl(null)
  }

  const stopMeter = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }

    analyserRef.current = null
  }

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const reset = (notify = true) => {
    clearTimer()
    stopMeter()

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop()
      } catch {
        // Ignore.
      }
    }

    mediaRecorderRef.current = null
    chunksRef.current = []
    stopTracks()
    clearAudioUrl()
    setElapsed(0)
    elapsedRef.current = 0
    setLevels(Array.from({ length: 24 }, () => 0.2))
    setPhase("idle")
    startedRef.current = false

    if (notify) {
      onChange?.(null)
    }
  }

  const startMeter = (stream) => {
    try {
      const context = new AudioContext()
      const source = context.createMediaStreamSource(stream)
      const analyser = context.createAnalyser()
      analyser.fftSize = 64
      source.connect(analyser)
      audioContextRef.current = context
      analyserRef.current = analyser

      const data = new Uint8Array(analyser.frequencyBinCount)

      const tick = () => {
        analyser.getByteFrequencyData(data)
        const next = Array.from({ length: 24 }, (_, index) => {
          const sample = data[index % data.length] || 0

          return Math.max(0.12, sample / 255)
        })
        setLevels(next)
        rafRef.current = requestAnimationFrame(tick)
      }

      tick()
    } catch {
      // Fallback: gentle pulse without analyser.
      const pulse = () => {
        setLevels((current) =>
          current.map((_, index) => 0.2 + Math.abs(Math.sin(Date.now() / 180 + index)) * 0.55),
        )
        rafRef.current = requestAnimationFrame(pulse)
      }
      pulse()
    }
  }

  const startRecording = async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toast.error("Microphone is not available in this browser")
      onCancel?.()
      return
    }

    if (typeof MediaRecorder === "undefined") {
      toast.error("Audio recording is not supported in this browser")
      onCancel?.()
      return
    }

    reset(false)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []

      const mimeType = preferredAudioMime()
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)

      mediaRecorderRef.current = recorder

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      })

      recorder.addEventListener("stop", () => {
        stopMeter()
        const type = recorder.mimeType || mimeType || "audio/webm"
        const blob = new Blob(chunksRef.current, { type })

        if (blob.size < 1) {
          reset(true)
          toast.error("Recording was empty")
          return
        }

        const file = new File(
          [blob],
          `voice-note-${Date.now()}.${extensionForMime(type)}`,
          { type },
        )
        const url = URL.createObjectURL(blob)
        const duration = elapsedRef.current

        clearAudioUrl()
        audioUrlRef.current = url
        setAudioUrl(url)
        setPhase("review")
        onChange?.({ file, url, duration })
        stopTracks()
      })

      startMeter(stream)
      recorder.start(100)
      setPhase("recording")
      setElapsed(0)
      elapsedRef.current = 0
      timerRef.current = window.setInterval(() => {
        elapsedRef.current += 1
        setElapsed(elapsedRef.current)
      }, 1000)
    } catch {
      reset(false)
      toast.error("Could not access the microphone")
      onCancel?.()
    }
  }

  const stopRecording = () => {
    clearTimer()
    const recorder = mediaRecorderRef.current

    if (recorder && recorder.state !== "inactive") {
      recorder.stop()
    } else {
      setPhase("idle")
      stopTracks()
      stopMeter()
    }
  }

  useEffect(() => {
    if (!open) {
      reset(false)
      return
    }

    if (autoStart && !startedRef.current) {
      startedRef.current = true
      void startRecording()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoStart])

  useEffect(() => {
    return () => {
      reset(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!open) {
    return null
  }

  if (phase === "review" && audioUrl) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label="Discard voice note"
                className="flex size-10 shrink-0 items-center justify-center rounded-full text-destructive transition-colors hover:bg-destructive/10"
                onClick={() => {
                  reset(true)
                  onCancel?.()
                }}
              >
                <Icon name="delete-bin-line" className="text-xl" />
              </button>
            }
          />
          <TooltipContent>Discard</TooltipContent>
        </Tooltip>
        <VoiceNotePlayer src={audioUrl} className="flex-1" />
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label="Re-record"
                className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
                onClick={() => {
                  startedRef.current = false
                  void startRecording()
                }}
              >
                <Icon name="mic-line" className="text-xl" />
              </button>
            }
          />
          <TooltipContent>Re-record</TooltipContent>
        </Tooltip>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full bg-muted/60 px-2 py-1.5",
        className,
      )}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label="Cancel recording"
              className="flex size-10 shrink-0 items-center justify-center rounded-full text-destructive transition-colors hover:bg-destructive/10"
              onClick={() => {
                reset(true)
                onCancel?.()
              }}
            >
              <Icon name="delete-bin-line" className="text-xl" />
            </button>
          }
        />
        <TooltipContent>Cancel</TooltipContent>
      </Tooltip>

      <div className="flex min-w-0 flex-1 items-center gap-2 px-1">
        <span className="size-2.5 shrink-0 animate-pulse rounded-full bg-destructive" />
        <div className="flex h-7 min-w-0 flex-1 items-end gap-0.5">
          {levels.map((level, index) => (
            <span
              key={index}
              className="min-w-0 flex-1 rounded-full bg-primary/70 transition-[height] duration-75"
              style={{ height: `${Math.round(level * 100)}%` }}
            />
          ))}
        </div>
        <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
          {formatElapsed(elapsed)}
        </span>
      </div>

      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label="Send voice note"
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform hover:scale-105"
              onClick={stopRecording}
            >
              <Icon name="check-line" className="text-xl" />
            </button>
          }
        />
        <TooltipContent>Done</TooltipContent>
      </Tooltip>
    </div>
  )
}
