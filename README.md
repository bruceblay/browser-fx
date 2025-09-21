# Tab Bitcrusher

A Chrome extension that applies real-time audio effects (delay, bitcrusher, phaser) to individual browser tabs using Web Audio API and Chrome's Tab Capture API.

## 🚧 Development Status

**Current Phase**: Phase 1 Complete - Foundation & Basic Tab Capture

### ✅ Phase 1 Completed Features:
- Plasmo MV3 extension framework setup with TypeScript
- Chrome Tab Capture API integration
- Offscreen document for stable Web Audio processing
- Basic popup UI with capture controls
- Service worker with tab audio capture functionality
- Audio passthrough (no effects applied yet)

### 🔄 Next Phases:
- **Phase 2**: Audio routing through Web Audio API with playback
- **Phase 3**: First effect implementation (Delay)
- **Phase 4**: Multi-tab support
- **Phase 5**: Bitcrusher effect with custom AudioWorklet
- **Phase 6**: Phaser effect and complete effect chain
- **Phase 7**: Production polish and UX enhancements

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+ and npm
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
   npm install
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

### Current Functionality (Phase 1)
1. Navigate to a tab with audio content (YouTube, Spotify, etc.)
2. Click the Tab Bitcrusher extension icon in your browser toolbar
3. Click "Capture Tab Audio" - this will "steal" the audio from the tab
4. Audio will now play through the extension in passthrough mode (no effects yet)
5. Click "Stop Capture" to return audio to the original tab

### ⚠️ Important Notes
- **User Gesture Required**: Tab capture requires clicking the extension button (Chrome security requirement)
- **Audio "Theft"**: When capturing, the original tab goes silent and audio routes through the extension
- **Passthrough Mode**: Currently no effects are applied - audio passes through unchanged
- **Single Tab**: Currently only supports one tab at a time

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
- **`offscreen.ts`**: Web Audio processing in persistent context
- **`offscreen.html`**: HTML container for the offscreen audio processor

## 📋 Development Scripts

```bash
# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Package extension for distribution
npm run package

# Format code
npm run format
```

## 🔧 Technical Details

### Chrome Permissions Required
- `tabCapture`: Capture audio from browser tabs
- `offscreen`: Maintain stable AudioContext in MV3

### Web Audio API Usage
- **AudioContext**: Created in offscreen document for stability
- **MediaStreamAudioSourceNode**: Processes captured tab audio
- **MediaStreamAudioDestinationNode**: Outputs processed audio
- **Audio Element**: Plays the processed stream back to user

### Browser Compatibility
- **Chrome 88+**: Required for Offscreen Documents API
- **Chrome 71+**: Required for Tab Capture API improvements
- **Manifest V3**: Modern extension architecture

## 🚨 Known Limitations

### Current Phase 1 Limitations
- Only passthrough audio (no effects yet)
- Single tab support only
- No effect parameter controls
- Basic error handling
- MediaStream transfer between contexts needs refinement

### Chrome API Limitations
- Tab capture requires user gesture (security requirement)
- Some sites with DRM protection may block capture
- Audio capture "steals" audio from the original tab
- Background service workers have limited lifetime in MV3

## 🛣️ Roadmap

See `/docs/implementation.md` for detailed implementation phases and testing criteria.

### Upcoming Features
- **Audio Effects**: Delay, bitcrusher, and phaser effects
- **Multi-Tab Processing**: Apply effects to multiple tabs simultaneously
- **Real-Time Controls**: Live parameter adjustment without audio interruption
- **Preset System**: Save and load effect configurations
- **Performance Optimization**: AudioWorklet implementation for low-latency processing

## 🤝 Contributing

This project is in active development. Phase 1 (foundation) is complete.

### Current Development Focus
- Phase 2: Implementing proper Web Audio routing and playback
- MediaStream transfer optimization between service worker and offscreen contexts
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
