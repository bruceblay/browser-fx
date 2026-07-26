import { theme } from "../theme"

interface HeaderProps {
  onInfoClick: () => void
  onClearClick: () => void
  onMidiClick: () => void
  onPresetsClick: () => void
  presetsOpen: boolean
  presetName: string | null
  presetDirty: boolean
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

// Floppy disk, drawn rather than typed so it stays monochrome with the other
// glyphs in this row. Inherits the button's color for the hover transition.
const DiskIcon = () => (
  <svg width="11" height="11" viewBox="0 0 16 16" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
    <path d="M2.6 2.6h8.3l2.5 2.5v8.3H2.6z" />
    <path d="M5.6 2.6v3.3h4.4V2.6" />
    <path d="M5.2 13.4V9.6h5.6v3.8" />
  </svg>
)

export function Header({ onInfoClick, onClearClick, onMidiClick, onPresetsClick, presetsOpen, presetName, presetDirty, midiLearnActive, isCapturing, onPowerToggle }: HeaderProps) {
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

      <div style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        alignItems: 'baseline',
        gap: 6,
        userSelect: 'none'
      }}>
        <span style={{
          fontSize: 13,
          fontWeight: 700,
          color: theme.textBright,
          letterSpacing: '0.2px',
          flexShrink: 0
        }}>
          Browser FX
        </span>
        {/* The loaded preset, with the usual asterisk once it's been touched */}
        {presetName && (
          <span style={{
            fontSize: 10,
            color: theme.textFaint,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {presetName}{presetDirty ? ' *' : ''}
          </span>
        )}
      </div>

      <button
        onClick={onPresetsClick}
        title="Presets"
        style={{
          ...iconButtonStyle,
          ...(presetsOpen ? {
            color: theme.textBright,
            borderColor: 'rgba(255,255,255,0.5)'
          } : {})
        }}
        onMouseOver={(e) => { if (!presetsOpen) brighten(e) }}
        onMouseOut={(e) => { if (!presetsOpen) dim(e) }}
      >
        <DiskIcon />
      </button>

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
