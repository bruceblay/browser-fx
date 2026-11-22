# Browser FX

Real-time audio effects for any browser tab: 24 effects, including Auto Tune, with studio-style
knobs, an audio-reactive cymatic visualizer, and MIDI controller support.
Built with the Web Audio API and Chrome's Tab Capture API.

Auto Tune snaps solo vocals to a chosen key and scale, with controls for retune
speed and mix. Use fast retuning for an obvious tuned sound or slower settings
for pitch glides. Major, minor, and pentatonic scales are available alongside
chromatic tuning. [Auto Tune details and listening test](docs/autotune.md).

- **Install**: [Chrome Web Store](https://chromewebstore.google.com/detail/browser-fx/oanepaeodkjbadgpgkolbidpbflbmmmd)
- **Demo video**: [YouTube](https://www.youtube.com/watch?v=2FvHIQayIIM)
- **Feature ideas**: [docs/future-features.md](docs/future-features.md)

## 🛠️ Development Setup

### Prerequisites
- Node.js 24 and npm
- Google Chrome browser
- Basic understanding of Chrome extensions and Web Audio API

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/bruceblay/tab-bitcrusher.git
   cd tab-bitcrusher
   ```

2. **Install dependencies**
   ```bash
   npm ci
   ```

3. **Build the extension**
   ```bash
   # For development with hot reload
   npm run dev

   # For production build
   npm run build
   ```

4. **Load in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked"
   - Select the `build/chrome-mv3-dev/` folder (for development) or `build/chrome-mv3-prod/` (for production)

## 🎵 How to Use

1. Navigate to a tab with audio content (YouTube, Spotify, etc.)
2. Click the Browser FX extension icon in your browser toolbar
3. Load a preset or choose effects from the dropdown and stack up to four
4. Click the power button to begin processing, then adjust the knobs as audio plays
5. Click the power button again to stop processing

### ⚠️ Important Notes
- **User Gesture Required**: Tab capture requires clicking the extension button (Chrome security requirement)
- **Audio "Theft"**: When capturing, the original tab goes silent and audio routes through the extension
- **Per-Tab Effects**: Each tab can have its own effect chain and settings
- **Auto Tune**: Works best on a solo voice; it does not isolate vocals from accompaniment

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   Browser Tab   │───▶│  Service Worker  │───▶│ Offscreen Document  │
│                 │    │                  │    │                     │
│ Audio Source    │    │ • Tab Capture    │    │ • Web Audio Graph   │
│ (YouTube, etc.) │    │ • UI Messages    │    │ • Effect Processing │
└─────────────────┘    │ • Lifecycle Mgmt │    │ • Audio Playback    │
                       └──────────────────┘    └─────────────────────┘
                                │                          │
                       ┌──────────────────┐    ┌─────────────────────┐
                       │   Popup UI       │    │    Your Speakers    │
                       │                  │    │                     │
                       │ • Start/Stop     │    │ Processed Audio ◄───┤
                       │ • Effect Controls│    │                     │
                       │ • Status Display │    └─────────────────────┘
                       └──────────────────┘
```

### Key Components

- **`background.ts`**: Service worker handling tab capture and offscreen document lifecycle
- **`popup.tsx`**: React-based UI for controlling audio capture and effects
- **`offscreen-effects.js`**: Web Audio processing in persistent context
- **`offscreen.html`**: HTML container for the offscreen audio processor

## 📋 Development Scripts

```bash
# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Test, build, and package for distribution
npm run release
# Upload artifact: build/chrome-mv3-prod.zip
```

## 🔧 Technical Details

### Chrome Permissions Required
- `tabCapture`: Capture audio from browser tabs
- `offscreen`: Maintain stable AudioContext in MV3

### Web Audio API Usage
- **AudioContext**: Created in offscreen document for stability
- **MediaStreamAudioSourceNode**: Processes captured tab audio
- **AudioDestinationNode**: Sends processed audio directly to the speakers
- **AudioWorkletNode**: Runs Auto Tune detection and synthesis with bundled WASM

### Browser Compatibility
- **Chrome 116+**: Required to use a service worker’s tab-capture stream ID in the offscreen document
- **Manifest V3**: Modern extension architecture

## 🚨 Known Limitations

### Effect Limitations
- Chains support up to four effects
- Auto Tune adds 90 ms of processing delay per instance, plus capture and device latency
- Automatic pitch tracking can be unreliable with overlapping voices or full music mixes

### Chrome API Limitations
- Tab capture requires user gesture (security requirement)
- Some sites with DRM protection may block capture
- Audio capture "steals" audio from the original tab
- Background service workers have limited lifetime in MV3

## 🛣️ Roadmap

See `/docs/implementation.md` for detailed implementation phases and testing criteria.

The extension currently includes 24 effects, per-tab chains, real-time controls,
saved presets, and MIDI support. Future work includes improving effect quality
and reducing processing latency.

## 🤝 Contributing

This project is in active development.

### Current Development Focus
- Effect quality and musical control
- Audio latency reduction and performance improvements

### Development Guidelines
- Follow existing TypeScript and React patterns
- Maintain Chrome MV3 compliance
- Test with various audio sources (music, video, games)
- Ensure graceful handling of edge cases (tab navigation, DRM content)

## 📄 License

ISC License - See LICENSE file for details.

## 🔗 Resources

- [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/mv3/)
- [Chrome Tab Capture API](https://developer.chrome.com/docs/extensions/reference/tabCapture/)
- [Chrome Offscreen API](https://developer.chrome.com/docs/extensions/reference/offscreen/)
- [Web Audio API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [Plasmo Extension Framework](https://docs.plasmo.com/)

---

**Note**: This extension is for educational and personal use. Respect website terms of service and copyright when processing audio content.
