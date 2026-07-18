import { theme } from "../theme"

interface HeaderProps {
  onInfoClick: () => void
  onClearClick: () => void
  onMidiClick: () => void
  midiLearnActive: boolean
  isCapturing: boolean
  onPowerToggle: () => void
}

const iconButtonStyle: React.CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: '50%',
  border: '1px solid rgba(255,255,255,0.25)',
  background: 'transparent',
  color: 'rgba(255,255,255,0.6)',
  fontSize: 11,
  fontWeight: 700,
  lineHeight: 1,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  transition: 'color 0.15s ease, border-color 0.15s ease'
}

const brighten = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.color = 'rgba(255,255,255,0.95)'
  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)'
}

const dim = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.color = 'rgba(255,255,255,0.6)'
  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'
}

export function Header({ onInfoClick, onClearClick, onMidiClick, midiLearnActive, isCapturing, onPowerToggle }: HeaderProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      height: 30,
      padding: '0 10px',
      background: theme.titleBarGradient,
      borderBottom: `1px solid ${theme.panelBorder}`,
      flexShrink: 0
    }}>
      {/* Device activator LED, toggles capture like Ableton's device on/off */}
      <button
        onClick={onPowerToggle}
        title={isCapturing ? "Stop audio capture" : "Start audio capture"}
        style={{
          width: 14,
          height: 14,
          borderRadius: '50%',
          border: `1px solid ${theme.panelBorder}`,
          background: isCapturing ? theme.led : '#232323',
          boxShadow: isCapturing ? `0 0 6px ${theme.ledGlow}` : 'inset 0 1px 2px rgba(0,0,0,0.6)',
          cursor: 'pointer',
          padding: 0,
          flexShrink: 0,
          transition: 'background 0.15s ease, box-shadow 0.15s ease'
        }}
      />

      <span style={{
        fontSize: 13,
        fontWeight: 700,
        color: theme.textBright,
        letterSpacing: '0.2px',
        flex: 1,
        userSelect: 'none'
      }}>
        Browser FX
      </span>

      <button
        onClick={onMidiClick}
        title={midiLearnActive ? "Exit MIDI learn mode" : "Map knobs to a MIDI controller"}
        style={{
          ...iconButtonStyle,
          fontSize: 10,
          ...(midiLearnActive ? {
            color: theme.led,
            borderColor: theme.led,
            boxShadow: `0 0 5px ${theme.ledGlow}`
          } : {})
        }}
        onMouseOver={(e) => { if (!midiLearnActive) brighten(e) }}
        onMouseOut={(e) => { if (!midiLearnActive) dim(e) }}
      >
        M
      </button>

      <button
        onClick={onClearClick}
        title="Clear all audio streams"
        style={{ ...iconButtonStyle, fontSize: 12, fontWeight: 400 }}
        onMouseOver={brighten}
        onMouseOut={dim}
      >
        ↺
      </button>

      <button
        onClick={onInfoClick}
        title="About Browser FX"
        style={iconButtonStyle}
        onMouseOver={brighten}
        onMouseOut={dim}
      >
        i
      </button>
    </div>
  )
}
