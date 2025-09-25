interface AboutViewProps {
  onBack: () => void
}

export function AboutView({ onBack }: AboutViewProps) {
  return (
    <div style={{
      padding: '14px 16px',
      color: 'white',
      height: '100%',
      minHeight: '600px',
      boxSizing: 'border-box',
      overflowY: 'auto',
      overscrollBehavior: 'contain'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 style={{
          fontSize: 18,
          fontWeight: 'bold',
          margin: 0,
          marginBottom: '8px',
          background: 'linear-gradient(45deg, #fff, #e0e0ff)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          About Browser FX
        </h1>
        <button
          onClick={onBack}
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.3)',
            background: 'rgba(255,255,255,0.1)',
            color: 'white',
            fontSize: 16,
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease'
          }}
          title="Back to main view"
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.2)'
            e.currentTarget.style.transform = 'scale(1.05)'
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
            e.currentTarget.style.transform = 'scale(1)'
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ color: 'white', lineHeight: '1.6' }}>
        <p style={{ margin: '0 0 4px 0' }}><strong>Browser FX</strong> is a real-time audio effects processor for web pages.</p>

        <h4 style={{ color: 'white', margin: '4px 0 10px 0', fontSize: 14, fontWeight: 600 }}>Available Effects:</h4>
        <ul style={{ color: 'white', paddingLeft: 20, margin: '0 0 6px 0' }}>
          <li style={{ marginBottom: 8 }}><strong>Bitcrusher</strong> - Digital degradation and lo-fi sounds</li>
          <li style={{ marginBottom: 8 }}><strong>Reverb</strong> - Spacious ambient reverb</li>
          <li style={{ marginBottom: 8 }}><strong>Hall Reverb</strong> - Large concert hall reverb with pre-delay and damping</li>
          <li style={{ marginBottom: 8 }}><strong>Distortion</strong> - Waveshaping distortion with tone control</li>
          <li style={{ marginBottom: 8 }}><strong>Chorus</strong> - Rich modulated doubling effect</li>
          <li style={{ marginBottom: 8 }}><strong>Phaser</strong> - Classic sweeping phase modulation</li>
          <li style={{ marginBottom: 8 }}><strong>Tremolo</strong> - Amplitude modulation with rate and depth</li>
          <li style={{ marginBottom: 8 }}><strong>Auto Panner</strong> - Automatic left-right panning with LFO modulation</li>
          <li style={{ marginBottom: 8 }}><strong>Delay</strong> - Simple delay effect</li>
          <li style={{ marginBottom: 8 }}><strong>Vibrato</strong> - Pitch modulation with multiple waveforms</li>
          <li style={{ marginBottom: 8 }}><strong>Auto Filter</strong> - LFO-controlled filter sweeps</li>
          <li style={{ marginBottom: 8 }}><strong>Pitch Shifter</strong> - Real-time pitch shifting without changing playback speed</li>
        </ul>

        <h4 style={{ color: 'white', margin: '6px 0 10px 0', fontSize: 14, fontWeight: 600 }}>How to Use:</h4>
        <ol style={{ color: 'white', paddingLeft: 20, margin: '0 0 6px 0' }}>
          <li style={{ marginBottom: 8 }}>Choose an audio effect from the dropdown</li>
          <li style={{ marginBottom: 8 }}>Click "Start" to begin processing</li>
          <li style={{ marginBottom: 8 }}>Adjust parameters in real-time with the sliders</li>
          <li style={{ marginBottom: 8 }}>Click "Stop" when finished</li>
        </ol>
      </div>
    </div>
  )
}