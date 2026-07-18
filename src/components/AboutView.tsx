import { theme } from "../theme"
import { Visualizer } from "./Visualizer"

interface AboutViewProps {
  onBack: () => void
  isCapturing: boolean
  tabId: number | null
}

export function AboutView({ onBack, isCapturing, tabId }: AboutViewProps) {
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: theme.panel
    }}>
      {/* Title bar */}
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
          <span style={{
            fontSize: 13,
            fontWeight: 700,
            color: theme.textBright,
            letterSpacing: '0.2px',
            flex: 1,
            userSelect: 'none'
          }}>
            About Browser FX
          </span>
          <button
            onClick={onBack}
            title="Back to main view"
            style={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.25)',
              background: 'transparent',
              color: 'rgba(255,255,255,0.6)',
              fontSize: 10,
              lineHeight: 1,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              transition: 'color 0.15s ease, border-color 0.15s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.color = 'rgba(255,255,255,0.95)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.color = 'rgba(255,255,255,0.6)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'
            }}
          >
            ✕
          </button>
        </div>

      {/* The cymatic field sits fixed behind the scrolling text */}
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        {/* Fixed chorus blue at active-state brightness, regardless of the
            selected effect or whether audio is running */}
        <Visualizer
          isCapturing={isCapturing}
          accentColor="#87CEEB"
          tabId={tabId}
          intensity={1.2}
          brightWhenIdle
        />
        <div style={{
          position: 'relative',
          zIndex: 1,
          height: '100%',
          padding: '12px 14px',
          boxSizing: 'border-box',
          color: theme.textDim,
          fontSize: 12,
          lineHeight: 1.6,
          overflowY: 'auto',
          overscrollBehavior: 'contain'
        }}>
          <p style={{ margin: '0 0 10px 0' }}>
            <strong style={{ color: theme.textBright }}>Browser FX</strong> is a real-time audio effects processor for web pages.
          </p>

          <h4 style={{
            color: theme.text,
            margin: '0 0 8px 0',
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'lowercase',
            letterSpacing: '0.5px'
          }}>
            available effects
          </h4>
          <ul style={{ paddingLeft: 18, margin: '0 0 12px 0' }}>
            <li style={{ marginBottom: 6 }}><strong style={{ color: theme.text }}>Bitcrusher</strong> - Digital degradation and lo-fi sounds</li>
            <li style={{ marginBottom: 6 }}><strong style={{ color: theme.text }}>CD Skipper</strong> - Rhythmic audio capture and loop playback</li>
            <li style={{ marginBottom: 6 }}><strong style={{ color: theme.text }}>Reverb</strong> - Spacious ambient reverb</li>
            <li style={{ marginBottom: 6 }}><strong style={{ color: theme.text }}>Filter</strong> - Low-pass filter with cutoff frequency and resonance control</li>
            <li style={{ marginBottom: 6 }}><strong style={{ color: theme.text }}>Vibrato</strong> - Pitch modulation with multiple waveforms</li>
            <li style={{ marginBottom: 6 }}><strong style={{ color: theme.text }}>Comb Filter</strong> - Metallic resonant comb filtering for texture effects</li>
            <li style={{ marginBottom: 6 }}><strong style={{ color: theme.text }}>Delay</strong> - Stereo bouncing delay effect</li>
            <li style={{ marginBottom: 6 }}><strong style={{ color: theme.text }}>DJ EQ</strong> - 3-band equalizer for quick tonal shaping</li>
            <li style={{ marginBottom: 6 }}><strong style={{ color: theme.text }}>Auto Panner</strong> - Automatic left-right panning with LFO modulation</li>
            <li style={{ marginBottom: 6 }}><strong style={{ color: theme.text }}>Hall Reverb</strong> - Large concert hall reverb with pre-delay</li>
            <li style={{ marginBottom: 6 }}><strong style={{ color: theme.text }}>Distortion</strong> - Waveshaping distortion with tone control</li>
            <li style={{ marginBottom: 6 }}><strong style={{ color: theme.text }}>Chorus</strong> - Rich modulated doubling effect</li>
            <li style={{ marginBottom: 6 }}><strong style={{ color: theme.text }}>Phaser</strong> - Classic sweeping phase modulation</li>
            <li style={{ marginBottom: 6 }}><strong style={{ color: theme.text }}>Tremolo</strong> - Amplitude modulation with rate and depth</li>
            <li style={{ marginBottom: 6 }}><strong style={{ color: theme.text }}>Auto Filter</strong> - LFO-controlled filter sweeps</li>
            <li style={{ marginBottom: 6 }}><strong style={{ color: theme.text }}>Pitch Shifter</strong> - Real-time pitch shifting without changing playback speed</li>
            <li style={{ marginBottom: 6 }}><strong style={{ color: theme.text }}>Compressor</strong> - Dynamic range compression for punch and consistency</li>
            <li style={{ marginBottom: 6 }}><strong style={{ color: theme.text }}>Flanger</strong> - Classic jet-plane whoosh flanging effect</li>
            <li style={{ marginBottom: 6 }}><strong style={{ color: theme.text }}>Ring Mod</strong> - Metallic and robotic ring modulation effects</li>
            <li style={{ marginBottom: 6 }}><strong style={{ color: theme.text }}>Tap Delay</strong> - Beat-synced delay with tap tempo and subdivision control</li>
            <li style={{ marginBottom: 6 }}><strong style={{ color: theme.text }}>Tape Stop</strong> - Turntable power-down with pitch ramp to silence</li>
            <li style={{ marginBottom: 6 }}><strong style={{ color: theme.text }}>Lo-Fi Tape</strong> - Analog tape degradation with wow, flutter and saturation</li>
          </ul>

          <h4 style={{
            color: theme.text,
            margin: '0 0 8px 0',
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'lowercase',
            letterSpacing: '0.5px'
          }}>
            how to use
          </h4>
          <ol style={{ paddingLeft: 18, margin: 0 }}>
            <li style={{ marginBottom: 6 }}>Choose an audio effect from the dropdown</li>
            <li style={{ marginBottom: 6 }}>Click the power button in the title bar to begin processing</li>
            <li style={{ marginBottom: 6 }}>Adjust parameters in real-time with the knobs</li>
            <li style={{ marginBottom: 6 }}>Click the power button again to stop, or ↺ to clear all audio streams</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
