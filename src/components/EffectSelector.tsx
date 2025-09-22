import { getEffectsList } from "../effects"

interface EffectSelectorProps {
  selectedEffect: string
  onEffectChange: (effectId: string) => void
}

export function EffectSelector({ selectedEffect, onEffectChange }: EffectSelectorProps) {
  return (
    <div>
      <select
        value={selectedEffect}
        onChange={(e) => onEffectChange(e.target.value)}
        style={{
          width: '100%',
          padding: '12px 16px',
          borderRadius: 8,
          border: '2px solid rgba(255,255,255,0.2)',
          background: 'rgba(255,255,255,0.1)',
          color: 'white',
          fontSize: 16,
          cursor: 'pointer',
          outline: 'none',
          backdropFilter: 'blur(10px)'
        }}
      >
        {getEffectsList().map(effect => (
          <option key={effect.id} value={effect.id} style={{ background: '#333', color: 'white' }}>
            {effect.name}
          </option>
        ))}
      </select>
    </div>
  )
}