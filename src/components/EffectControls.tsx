import { type EffectConfig, type ParameterConfig } from "../effects"
import { KnobHeadless } from "react-knob-headless"
import { theme } from "../theme"

interface EffectControlsProps {
  effectConfig: EffectConfig | null
  effectParams: Record<string, number>
  isCapturing: boolean
  onParamUpdate: (param: string, value: number) => void
  onStart: () => void
}

const KNOB_SIZE = 68
const ARC_RADIUS = 30
const ARC_STROKE = 3.5
const FACE_SIZE = 46
const ANGLE_MIN = -135
const ANGLE_MAX = 135

const mapTo01 = (value: number, min: number, max: number) => {
  return (value - min) / (max - min)
}

// Point on a circle where angle 0 is 12 o'clock
const polarPoint = (cx: number, cy: number, r: number, angleDeg: number) => {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

const arcPath = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
  const start = polarPoint(cx, cy, r, startAngle)
  const end = polarPoint(cx, cy, r, endAngle)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`
}

const formatValue = (v: number, param: ParameterConfig): string => {
  switch (param.unit) {
    case '%': return `${Math.round(v * 100)}%`
    case 's': return `${parseFloat(v.toFixed(1))}s`
    case 'ms': return `${Math.round(v)}ms`
    case 'Hz': return v >= 1000 ? `${parseFloat((v / 1000).toFixed(1))}kHz` : `${Math.round(v)}Hz`
    case 'dB': return `${parseFloat(v.toFixed(1))}dB`
    case 'semitones': return `${v > 0 ? '+' : ''}${Math.round(v)}st`
    case 'bpm': return `${Math.round(v)}`
    case ':1': return `${Math.round(v)}:1`
    default: return param.step >= 1 ? `${Math.round(v)}` : v.toFixed(2)
  }
}

export function EffectControls({
  effectConfig,
  effectParams,
  isCapturing,
  onParamUpdate,
  onStart
}: EffectControlsProps) {
  if (!effectConfig) {
    return null
  }

  const center = KNOB_SIZE / 2
  const accent = effectConfig.sliderColor

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Lighter top spacer keeps the knobs closer to the selector */}
      <div style={{ flex: 0.5 }} />

      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '14px 10px',
        justifyContent: 'space-evenly'
      }}>
        {effectConfig.parameters.map((param) => {
          const currentValue = effectParams[param.key] ?? param.default
          const value01 = mapTo01(currentValue, param.min, param.max)
          const valueAngle = ANGLE_MIN + value01 * (ANGLE_MAX - ANGLE_MIN)

          return (
            <div key={param.key} style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              minWidth: 76
            }}>
              <KnobHeadless
                aria-label={param.label}
                valueRaw={currentValue}
                valueMin={param.min}
                valueMax={param.max}
                valueRawRoundFn={(v) => Math.round(v / param.step) * param.step}
                valueRawDisplayFn={(v) => formatValue(v, param)}
                onValueRawChange={(v) => isCapturing && onParamUpdate(param.key, v)}
                dragSensitivity={0.006}
                style={{
                  width: KNOB_SIZE,
                  height: KNOB_SIZE,
                  position: 'relative',
                  cursor: isCapturing ? 'ns-resize' : 'not-allowed',
                  userSelect: 'none',
                  touchAction: 'none',
                  outline: 'none'
                }}
              >
                {/* Value arc */}
                <svg
                  width={KNOB_SIZE}
                  height={KNOB_SIZE}
                  style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
                >
                  <path
                    d={arcPath(center, center, ARC_RADIUS, ANGLE_MIN, ANGLE_MAX)}
                    stroke={theme.knobTrack}
                    strokeWidth={ARC_STROKE}
                    strokeLinecap="round"
                    fill="none"
                  />
                  {value01 > 0.001 && (
                    <path
                      d={arcPath(center, center, ARC_RADIUS, ANGLE_MIN, valueAngle)}
                      stroke={isCapturing ? accent : `${accent}59`}
                      strokeWidth={ARC_STROKE}
                      strokeLinecap="round"
                      fill="none"
                    />
                  )}
                </svg>

                {/* Cream knob face */}
                <div style={{
                  position: 'absolute',
                  width: FACE_SIZE,
                  height: FACE_SIZE,
                  left: (KNOB_SIZE - FACE_SIZE) / 2,
                  top: (KNOB_SIZE - FACE_SIZE) / 2,
                  borderRadius: '50%',
                  background: theme.cream,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.5), inset 0 -1px 2px rgba(0,0,0,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: '#1c1c1c',
                    fontVariantNumeric: 'tabular-nums',
                    pointerEvents: 'none',
                    whiteSpace: 'nowrap'
                  }}>
                    {formatValue(currentValue, param)}
                  </span>
                </div>

                {/* Indicator tick on the knob face edge */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  transform: `rotate(${valueAngle}deg)`,
                  pointerEvents: 'none'
                }}>
                  <div style={{
                    position: 'absolute',
                    width: 2,
                    height: 7,
                    background: theme.knobIndicator,
                    top: (KNOB_SIZE - FACE_SIZE) / 2 + 1,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    borderRadius: 1
                  }} />
                </div>
              </KnobHeadless>

              <label style={{
                marginTop: 5,
                fontSize: 11,
                fontWeight: 500,
                color: theme.textDim,
                textTransform: 'lowercase',
                letterSpacing: '0.3px',
                textAlign: 'center',
                userSelect: 'none'
              }}>
                {param.label}
              </label>
            </div>
          )
        })}
      </div>

      {/* Hint sits centered in the leftover space below the knobs */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {!isCapturing && (
          <button
            onClick={onStart}
            title="Start audio capture"
            style={{
              background: 'none',
              border: 'none',
              padding: '4px 8px',
              fontFamily: 'inherit',
              fontSize: 10,
              color: theme.textFaint,
              textTransform: 'lowercase',
              letterSpacing: '0.3px',
              cursor: 'pointer',
              userSelect: 'none',
              transition: 'color 0.15s ease'
            }}
            onMouseOver={(e) => { e.currentTarget.style.color = theme.textDim }}
            onMouseOut={(e) => { e.currentTarget.style.color = theme.textFaint }}
          >
            press <span style={{ color: theme.led, padding: '0 2px' }}>●</span> to start
          </button>
        )}
      </div>
    </div>
  )
}
