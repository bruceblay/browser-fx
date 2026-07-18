import { useEffect, useRef } from "react"

interface VisualizerProps {
  isCapturing: boolean
  accentColor: string
  tabId: number | null
}

const BAND_COUNT = 16

const hexToRgb = (hex: string) => {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const n = parseInt(full, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

// Audio-reactive cymatic background: a Chladni plate pattern, the nodal lines
// where sand would collect on a vibrating plate, rendered as a dot field in
// the effect's accent color. Bass and treble drive the plate modes so the
// ridges sweep and reorganize with the audio. Falls back to a gentle
// time-driven morph when idle or when no analyser data is available.
export function Visualizer({ isCapturing, accentColor, tabId }: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const bandsRef = useRef<number[] | null>(null)
  const accentRef = useRef(accentColor)
  const capturingRef = useRef(isCapturing)
  accentRef.current = accentColor
  capturingRef.current = isCapturing

  // Poll the offscreen document's analyser while capturing. Uses the same
  // broadcast message path as the rest of the extension, which the offscreen
  // document answers synchronously.
  useEffect(() => {
    if (!isCapturing || tabId === null) {
      bandsRef.current = null
      return
    }

    let cancelled = false
    const timer = setInterval(() => {
      try {
        chrome.runtime.sendMessage({ type: 'GET_VISUALIZER_FRAME', tabId }, (response) => {
          const err = chrome.runtime.lastError
          if (!cancelled) {
            bandsRef.current = !err && response?.bands ? response.bands : null
          }
        })
      } catch {
        bandsRef.current = null
      }
    }, 50)

    return () => {
      cancelled = true
      clearInterval(timer)
      bandsRef.current = null
    }
  }, [isCapturing, tabId])

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.max(1, Math.round(rect.width * dpr))
      canvas.height = Math.max(1, Math.round(rect.height * dpr))
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    const smooth = new Array(BAND_COUNT).fill(0)
    let raf = 0
    let rotation = 0
    let slowLevel = 0
    let punchEnv = 0
    let lastNow = performance.now()
    const start = lastNow

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      const t = (now - start) / 1000
      const dt = Math.min((now - lastNow) / 1000, 0.1)
      lastNow = now
      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)

      // Ease band values toward their targets: fast attack, slow release.
      // Idle target is a slow breathing motion instead of audio data.
      const live = capturingRef.current ? bandsRef.current : null
      for (let i = 0; i < BAND_COUNT; i++) {
        const idle = 0.06 + 0.04 * Math.sin(t * 0.4 + i * 0.7)
        const target = live ? live[i] : idle
        smooth[i] += (target - smooth[i]) * (target > smooth[i] ? 0.55 : 0.1)
      }

      const avg = (a: number, b: number) => {
        let s = 0
        for (let i = a; i <= b; i++) s += smooth[i]
        return s / (b - a + 1)
      }
      // Squaring expands contrast: quiet passages stay calm, hits pop
      const shape = (v: number) => v * v
      const bass = shape(avg(0, 4))
      const mid = shape(avg(5, 10))
      const high = shape(avg(11, 15))
      const level = (bass + mid + high) / 3

      // Onset detector: energy jumping above its own recent average reads as
      // a transient, and punchEnv spikes then decays quickly
      slowLevel += (level - slowLevel) * 0.02
      const punch = Math.max(0, Math.min((level - slowLevel * 1.05) * 4, 1))
      punchEnv = Math.max(punch, punchEnv - dt * 3)

      const { r, g, b } = hexToRgb(accentRef.current)
      const cx = w / 2
      const cy = h * 0.48
      const R = Math.min(w, h) * 0.62

      // Slow rotation of the plate, nudged by the level and kicked by hits
      rotation += dt * (0.05 + level * 0.5 + punchEnv * 1.2)
      const cosR = Math.cos(rotation)
      const sinR = Math.sin(rotation)

      // Plate modes: bass and treble each bend one mode number, so the nodal
      // pattern reshapes with the music; slow drift keeps it alive when steady
      const n = 2 + bass * 3.5 + 0.4 * Math.sin(t * 0.25)
      const m = 3 + high * 4 + 0.4 * Math.cos(t * 0.18)

      // Mids widen the ridges; hits flash the whole field brighter
      const ridgeWidth = 0.35 + mid * 0.3
      const baseAlpha = live
        ? Math.min(0.4 + level * 0.6 + punchEnv * 0.25, 0.85)
        : 0.09

      // Bass swells the plate slightly; transients snap it outward
      const scale = 1 + bass * 0.04 + punchEnv * 0.05

      const step = 5 * dpr
      const dotR = 1.3 * dpr
      const colorCache: Record<number, string> = {}

      for (let gx = cx - R; gx <= cx + R; gx += step) {
        for (let gy = cy - R; gy <= cy + R; gy += step) {
          const dx0 = (gx - cx) / R
          const dy0 = (gy - cy) / R
          const dist2 = dx0 * dx0 + dy0 * dy0
          if (dist2 > 1) continue

          // Sample the plate in rotated, gently scaled coordinates
          const dx = (dx0 * cosR - dy0 * sinR) / scale
          const dy = (dx0 * sinR + dy0 * cosR) / scale
          const u = (dx + 1) / 2
          const v = (dy + 1) / 2
          const f = Math.sin(n * Math.PI * u) * Math.sin(m * Math.PI * v) +
                    Math.sin(m * Math.PI * u) * Math.sin(n * Math.PI * v)
          const nearNode = 1 - Math.abs(f) / ridgeWidth
          if (nearNode <= 0) continue

          // Radial fade vignettes the field into the panel
          const alpha = baseAlpha * nearNode * (1 - dist2)
          if (alpha < 0.01) continue

          const q = Math.round(alpha * 24)
          let style = colorCache[q]
          if (!style) {
            style = `rgba(${r}, ${g}, ${b}, ${(q / 24).toFixed(3)})`
            colorCache[q] = style
          }
          ctx.fillStyle = style
          ctx.fillRect(gx - dotR, gy - dotR, dotR * 2, dotR * 2)
        }
      }
    }

    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none'
      }}
    />
  )
}
