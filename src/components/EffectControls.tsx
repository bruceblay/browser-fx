import { type EffectConfig } from "../effects"
import { KnobHeadless } from "react-knob-headless"

interface EffectControlsProps {
  effectConfig: EffectConfig | null
  effectParams: Record<string, number>
  isCapturing: boolean
  onParamUpdate: (param: string, value: number) => void
}

// Helper function to map value to normalized 0-1 range
const mapTo01 = (value: number, min: number, max: number) => {
  return (value - min) / (max - min)
}

export function EffectControls({
  effectConfig,
  effectParams,
  isCapturing,
  onParamUpdate
}: EffectControlsProps) {
  if (!effectConfig) {
    return null
  }

  return (
    <div style={{ marginTop: 4 }}>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '16px',
        justifyContent: 'space-evenly',
        marginBottom: 12,
        marginTop: 24
      }}>
        {effectConfig.parameters.map((param) => {
          const currentValue = effectParams[param.key] ?? param.default

          const valueDisplayText = (() => {
            if (param.unit === '%') {
              return `${Math.round(currentValue * 100)}%`
            } else if (param.unit === 's') {
              return `${parseFloat(currentValue.toFixed(1))}s`
            }
            return currentValue.toFixed(2)
          })()

          // Calculate normalized value (0-1) for visual angle
          const value01 = mapTo01(currentValue, param.min, param.max)
          const angleMin = -135
          const angleMax = 135
          const angle = angleMin + (value01 * (angleMax - angleMin))

          return (
            <div key={param.key} style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              minWidth: '80px'
            }}>
              <KnobHeadless
                aria-label={param.label}
                valueRaw={currentValue}
                valueMin={param.min}
                valueMax={param.max}
                valueRawRoundFn={(v) => {
                  const step = param.step
                  return Math.round(v / step) * step
                }}
                valueRawDisplayFn={(v) => {
                  if (param.unit === '%') {
                    return `${Math.round(v * 100)}%`
                  } else if (param.unit === 's') {
                    return `${parseFloat(v.toFixed(1))}s`
                  }
                  return v.toFixed(2)
                }}
                onValueRawChange={(v) => isCapturing && onParamUpdate(param.key, v)}
                dragSensitivity={0.006}
                style={{
                  width: '70px',
                  height: '70px',
                  position: 'relative',
                  cursor: isCapturing ? 'pointer' : 'not-allowed',
                  userSelect: 'none',
                  borderRadius: '50%',
                  backgroundColor: effectConfig.sliderColor,
                  opacity: isCapturing ? 1 : 0.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  outline: 'none'
                }}
              >
                {/* Rotating indicator line */}
                <div style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  transform: `rotate(${angle}deg)`,
                  pointerEvents: 'none'
                }}>
                  <div style={{
                    position: 'absolute',
                    width: '2px',
                    height: '20px',
                    backgroundColor: '#fff',
                    top: '0px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    borderRadius: '2px'
                  }} />
                </div>

                {/* Value display */}
                <div style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#fff',
                  textAlign: 'center',
                  zIndex: 1,
                  pointerEvents: 'none'
                }}>
                  {valueDisplayText}
                </div>
              </KnobHeadless>
              <label style={{
                marginTop: 8,
                fontSize: 12,
                fontWeight: 500,
                color: 'rgba(255,255,255,1)',
                textAlign: 'center'
              }}>
                {param.label}
              </label>
            </div>
          )
        })}
      </div>

      <div style={{
        fontSize: 12,
        color: 'rgba(255,255,255,0.8)',
        fontStyle: 'italic',
        marginTop: 8,
        marginBottom: 8,
      }}>
        {!isCapturing
          ? "Controls will be active when audio capture is running"
          : ""
        }
      </div>
    </div>
  )
}
