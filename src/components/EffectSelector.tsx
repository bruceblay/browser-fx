import { getEffectsList } from "../effects"
import { theme } from "../theme"

interface EffectSelectorProps {
  selectedEffect: string
  onEffectChange: (effectId: string) => void
}

export function EffectSelector({ selectedEffect, onEffectChange }: EffectSelectorProps) {
  return (
    <div style={{ position: 'relative' }}>
      <select
        value={selectedEffect}
        onChange={(e) => onEffectChange(e.target.value)}
        style={{
          width: '100%',
          padding: '5px 8px',
          borderRadius: 3,
          background: theme.control,
          border: `1px solid ${theme.controlBorder}`,
          color: theme.text,
          fontSize: 12,
          fontWeight: 500,
          fontFamily: 'inherit',
          cursor: 'pointer',
          outline: 'none',
          appearance: 'none',
          WebkitAppearance: 'none'
        }}
      >
        {getEffectsList().map(effect => (
          <option key={effect.id} value={effect.id} style={{ background: theme.control, color: theme.text }}>
            {effect.name}
          </option>
        ))}
      </select>
      <span style={{
        position: 'absolute',
        right: 8,
        top: '50%',
        transform: 'translateY(-50%)',
        pointerEvents: 'none',
        fontSize: 8,
        color: theme.textDim
      }}>
        ▼
      </span>
    </div>
  )
}
