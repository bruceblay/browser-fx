import { type EffectConfig, type ParameterConfig } from "../effects"
import { KnobHeadless } from "react-knob-headless"
import { theme } from "../theme"

interface EffectControlsProps {
  effectConfig: EffectConfig | null
  effectParams: Record<string, number>
  isCapturing: boolean
  // Knob diameter in px; shrinks as the chain grows to save vertical space
  knobSize: number
  // MIDI learn UI renders only where this is true (slot 1 of the chain)
  midiLearn: boolean
  midiLearnTarget: number | null
  midiMappings: Record<string, number>
  onArmKnob: (index: number) => void
  onParamUpdate: (param: string, value: number) => void
}

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
    // Percent params come in two scales: 0..1 fractions and 0..100 ranges
    case '%': return param.max > 1 ? `${Math.round(v)}%` : `${Math.round(v * 100)}%`
    case 's': return v < 1 ? `${Math.round(v * 1000)}ms` : `${parseFloat(v.toFixed(1))}s`
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
  knobSize,
  midiLearn,
  midiLearnTarget,
  midiMappings,
  onArmKnob,
  onParamUpdate
}: EffectControlsProps) {
  if (!effectConfig) {
    return null
  }

  // All dimensions derive from the knob size (68 is the full-size reference)
  const K = knobSize
  const scale = K / 68
  const arcRadius = 30 * scale
  const arcStroke = Math.max(2.5, 3.5 * scale)
  const face = 46 * scale
  const center = K / 2
  const valueFont = K >= 62 ? 10 : K >= 50 ? 9 : 8
  const labelFont = K >= 62 ? 11 : 10
  const tickHeight = Math.max(5, 7 * scale)
  const accent = effectConfig.sliderColor

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '10px 8px',
      justifyContent: 'space-evenly',
      width: '100%'
    }}>
      {effectConfig.parameters.map((param, paramIndex) => {
        const currentValue = effectParams[param.key] ?? param.default
        const value01 = mapTo01(currentValue, param.min, param.max)
        const valueAngle = ANGLE_MIN + value01 * (ANGLE_MAX - ANGLE_MIN)
        const armed = midiLearn && midiLearnTarget === paramIndex
        const mappedCc = Object.keys(midiMappings).find(cc => midiMappings[cc] === paramIndex)

        return (
          <div key={param.key} style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            minWidth: K + 12,
            position: 'relative'
          }}>
            <KnobHeadless
              aria-label={param.label}
              valueRaw={currentValue}
              valueMin={param.min}
              valueMax={param.max}
              valueRawRoundFn={(v) => Math.round(v / param.step) * param.step}
              valueRawDisplayFn={(v) => formatValue(v, param)}
              onValueRawChange={(v) => onParamUpdate(param.key, v)}
              dragSensitivity={0.006}
              axis="xy"
              style={{
                width: K,
                height: K,
                position: 'relative',
                cursor: 'ns-resize',
                userSelect: 'none',
                touchAction: 'none',
                outline: 'none'
              }}
            >
              {/* Value arc */}
              <svg
                width={K}
                height={K}
                style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
              >
                <path
                  d={arcPath(center, center, arcRadius, ANGLE_MIN, ANGLE_MAX)}
                  stroke={theme.knobTrack}
                  strokeWidth={arcStroke}
                  strokeLinecap="round"
                  fill="none"
                />
                {value01 > 0.001 && (
                  <path
                    d={arcPath(center, center, arcRadius, ANGLE_MIN, valueAngle)}
                    stroke={isCapturing ? accent : `${accent}59`}
                    strokeWidth={arcStroke}
                    strokeLinecap="round"
                    fill="none"
                  />
                )}
              </svg>

              {/* Cream knob face */}
              <div style={{
                position: 'absolute',
                width: face,
                height: face,
                left: (K - face) / 2,
                top: (K - face) / 2,
                borderRadius: '50%',
                background: theme.cream,
                boxShadow: '0 1px 3px rgba(0,0,0,0.5), inset 0 -1px 2px rgba(0,0,0,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <span style={{
                  fontSize: valueFont,
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
                  height: tickHeight,
                  background: theme.knobIndicator,
                  top: (K - face) / 2 + 1,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  borderRadius: 1
                }} />
              </div>
            </KnobHeadless>

            {/* MIDI learn overlay: click to arm this knob for the next CC */}
            {midiLearn && (
              <div
                onClick={() => onArmKnob(paramIndex)}
                title="Click, then move a control on your MIDI device"
                style={{
                  position: 'absolute',
                  top: -4,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: K + 8,
                  height: K + 8,
                  borderRadius: '50%',
                  border: `1.5px ${armed ? 'solid' : 'dashed'} ${theme.led}`,
                  boxShadow: armed ? `0 0 8px ${theme.ledGlow}` : 'none',
                  cursor: 'pointer',
                  zIndex: 2,
                  boxSizing: 'border-box'
                }}
              />
            )}

            <label style={{
              marginTop: 4,
              fontSize: labelFont,
              fontWeight: 500,
              color: theme.textDim,
              textTransform: 'lowercase',
              letterSpacing: '0.3px',
              textAlign: 'center',
              userSelect: 'none'
            }}>
              {param.label}
            </label>

            {midiLearn && mappedCc !== undefined && (
              <span style={{
                marginTop: 2,
                fontSize: 9,
                color: theme.led,
                letterSpacing: '0.4px',
                userSelect: 'none'
              }}>
                cc {mappedCc}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
