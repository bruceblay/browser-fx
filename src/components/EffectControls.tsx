import { type EffectConfig } from "../effects"

interface EffectControlsProps {
  effectConfig: EffectConfig | null
  effectParams: Record<string, number>
  isCapturing: boolean
  onParamUpdate: (param: string, value: number) => void
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
      <h4 style={{
        fontSize: 14,
        fontWeight: 600,
        marginBottom: 12,
        color: 'rgba(255,255,255,0.9)'
      }}>
        {effectConfig.name} Controls
      </h4>

      {effectConfig.parameters.map((param, index) => {
        const currentValue = effectParams[param.key] ?? param.default
        let displayValue = currentValue

        if (param.unit === '%') {
          displayValue = Math.round(currentValue * 100)
        } else if (param.unit === 's') {
          displayValue = parseFloat(currentValue.toFixed(1))
        }

        return (
          <div key={param.key} style={{ marginBottom: 8 }}>
            <label style={{
              display: 'block',
              marginBottom: 6,
              fontSize: 12,
              color: 'rgba(255,255,255,0.8)'
            }}>
              {param.label}: {displayValue}{param.unit === '%' ? '%' : (param.unit || '')}
            </label>
            <input
              type="range"
              min={param.min}
              max={param.max}
              step={param.step}
              value={currentValue}
              onChange={(e) => onParamUpdate(param.key, parseFloat(e.target.value))}
              style={{
                width: '100%',
                accentColor: "#87ceeb"
              }}
              disabled={!isCapturing}
            />
          </div>
        )
      })}

      <div style={{
        fontSize: 12,
        color: 'rgba(255,255,255,0.6)',
        fontStyle: 'italic',
        marginTop: 8,
        marginBottom: 8,
      }}>
        {!isCapturing
          ? "Controls will be active when audio capture is running"
          : "Adjust parameters in real-time"
        }
      </div>
    </div>
  )
}