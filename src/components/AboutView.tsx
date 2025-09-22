interface AboutViewProps {
  onClose: () => void
}

export function AboutView({ onClose }: AboutViewProps) {
  return (
    <div className="about-container">
      <div className="about-header">
        <h2 className="about-title">About Browser FX</h2>
        <button
          onClick={onClose}
          className="close-button"
        >
          ✕
        </button>
      </div>

      <div className="about-content">
        <p><strong>Browser FX</strong> is a real-time audio effects processor for web pages.</p>

        <h4 className="about-section-title">Available Effects:</h4>
        <ul className="about-list">
          <li><strong>Bitcrusher</strong> - Digital degradation and lo-fi sounds</li>
          <li><strong>Reverb</strong> - Spacious ambient reverb</li>
          <li><strong>Distortion</strong> - Waveshaping distortion with tone control</li>
          <li><strong>Chorus</strong> - Rich modulated doubling effect</li>
          <li><strong>Phaser</strong> - Classic sweeping phase modulation</li>
          <li><strong>Tremolo</strong> - Amplitude modulation with rate and depth</li>
          <li><strong>Ping Pong Delay</strong> - Stereo bouncing delay effect</li>
          <li><strong>Vibrato</strong> - Pitch modulation with multiple waveforms</li>
          <li><strong>Auto Filter</strong> - LFO-controlled filter sweeps</li>
        </ul>

        <h4 className="about-section-title">How to Use:</h4>
        <ol className="about-list">
          <li>Choose an audio effect from the dropdown</li>
          <li>Click "Capture Tab Audio" to start processing</li>
          <li>Adjust parameters in real-time with the sliders</li>
          <li>Click "Stop Capture" when finished</li>
        </ol>

        <div className="credits-box">
          <strong>Credits:</strong> Most effects are inspired by and based on implementations from{" "}
          <a
            href="https://tonejs.github.io/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#0066cc", textDecoration: "underline" }}
          >
            Tone.js
          </a>
          , an excellent Web Audio framework by Yotam Mann. Thank you to the Tone.js team for their incredible work on Web Audio abstractions and effect implementations.
        </div>

        <div className="tech-note-box">
          <strong>Technical Note:</strong> All effects are processed in real-time using the Web Audio API.
          Audio processing happens locally in your browser - no data is sent to external servers.
        </div>
      </div>
    </div>
  )
}