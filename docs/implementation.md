# Tab Bitcrusher - Implementation Plan

## Project Overview

A Chrome extension that applies real-time audio effects (delay, bitcrusher, phaser) to individual browser tabs using Web Audio API and Chrome's Tab Capture API.

## Architecture Overview

### Core Components
- **Service Worker**: Handles tab capture and offscreen document lifecycle
- **Offscreen Document**: Maintains stable AudioContext for audio processing
- **Popup UI**: User interface for effect controls and tab selection
- **Web Audio Graph**: MediaStreamAudioSourceNode → Effects Chain → MediaStreamDestination

### Key Technologies
- Chrome MV3 APIs: `tabCapture`, `offscreen`
- Web Audio API with AudioWorklet for low-latency processing
- Plasmo framework for extension development
- Tone.js for initial effect implementations
- TypeScript for type safety

## Implementation Phases

### Phase 1: Foundation & Basic Tab Capture
**Goal**: Establish MV3 extension structure with working tab audio capture

#### Deliverables:
- [ ] Plasmo project setup with TypeScript
- [ ] MV3 manifest with required permissions (`tabCapture`, `offscreen`)
- [ ] Service worker with basic tab capture functionality
- [ ] Offscreen document creation and lifecycle management
- [ ] Basic popup UI with "Capture Tab" button

#### Testing Criteria:
- Extension loads without errors in Chrome
- Can capture audio from a tab (steals audio from original tab)
- Offscreen document creates successfully
- Audio stream passes through unchanged (passthrough mode)

#### Technical Notes:
- `chrome.tabCapture.capture({audio: true})` requires user gesture
- Offscreen document needed for stable AudioContext in MV3
- Must handle MediaStream transfer between service worker and offscreen

#### Post-Phase 1:
- [ ] Create README.md with project description, build instructions, and usage guide

---

### Phase 2: Audio Passthrough & Playback
**Goal**: Route captured audio through Web Audio API and play it back

#### Deliverables:
- [ ] Web Audio graph setup in offscreen document
- [ ] MediaStreamAudioSourceNode → MediaStreamDestination connection
- [ ] Audio playback via `<audio>` element
- [ ] Basic error handling for capture failures
- [ ] "Bypass/Stop Processing" panic button

#### Testing Criteria:
- Captured tab audio plays back without noticeable latency
- Audio quality matches original (no artifacts)
- Can start/stop processing cleanly
- Handles tab navigation and audio state changes
- Works with various audio sources (video, music, system sounds)

#### Technical Notes:
- Keep AudioContext sample rate consistent
- Monitor for audio dropouts/glitches
- Handle protected content gracefully

---

### Phase 3: Single Effect Implementation (Delay)
**Goal**: Implement first audio effect with parameter controls

#### Deliverables:
- [ ] Tone.js integration for FeedbackDelay
- [ ] Popup UI with delay controls (time, feedback, wet/dry mix)
- [ ] Parameter communication between popup and offscreen
- [ ] Real-time parameter updates without audio interruption

#### Testing Criteria:
- Delay effect audibly works with various settings
- Parameter changes respond immediately
- No audio dropouts when adjusting controls
- Settings persist during tab switches
- Extreme parameter values don't break audio

#### Technical Notes:
- Use `chrome.runtime.sendMessage` for parameter updates
- Debounce rapid parameter changes
- Validate parameter ranges

---

### Phase 4: Multi-Tab Support
**Goal**: Apply effects to multiple tabs simultaneously

#### Deliverables:
- [ ] Tab selection UI in popup
- [ ] Multiple MediaStream handling in offscreen
- [ ] Per-tab effect state management
- [ ] "Apply to all audible tabs" toggle
- [ ] Auto-capture new audible tabs option

#### Testing Criteria:
- Can process 2-3 tabs simultaneously without performance issues
- Each tab maintains independent effect settings
- Audio routing remains stable when switching between tabs
- New tabs can be auto-captured when they become audible
- Memory usage stays reasonable with multiple streams

#### Technical Notes:
- Listen for `chrome.tabs.onUpdated` with `audible: true`
- Manage multiple AudioContext graphs efficiently
- Handle tab closing/navigation cleanup

---

### Phase 5: Additional Effects (Bitcrusher)
**Goal**: Add bitcrusher effect with custom AudioWorklet implementation

#### Deliverables:
- [ ] Custom AudioWorklet processor for bitcrusher
- [ ] Bit depth and sample rate reduction parameters
- [ ] Integration with existing effect chain
- [ ] A/B testing against Tone.js BitCrusher
- [ ] Performance optimization

#### Testing Criteria:
- Bitcrusher produces expected lo-fi distortion
- AudioWorklet performs better than ScriptProcessorNode
- Can combine with delay effect smoothly
- CPU usage remains acceptable
- Works across different audio content types

#### Technical Notes:
- AudioWorklet runs on separate thread for better performance
- Implement proper parameter smoothing
- Consider WASM for more complex DSP if needed

---

### Phase 6: Final Effect & Polish (Phaser)
**Goal**: Complete the three-effect chain and add production polish

#### Deliverables:
- [ ] Phaser effect implementation (Tone.js → custom AudioWorklet)
- [ ] Complete effect chain: Delay → Bitcrusher → Phaser
- [ ] Effect ordering/routing options
- [ ] Preset system for common configurations
- [ ] Performance monitoring and optimization

#### Testing Criteria:
- All three effects work individually and in combination
- No audio artifacts or performance degradation
- Preset system saves/loads reliably
- Extension handles edge cases gracefully (DRM content, tab crashes)
- Memory usage is stable over extended use

#### Technical Notes:
- Optimize effect chain for minimal latency
- Add comprehensive error handling
- Consider effect bypass options for CPU relief

---

### Phase 7: Production Features & UX
**Goal**: Add production-ready features and polish user experience

#### Deliverables:
- [ ] Visual feedback (audio level meters, effect visualization)
- [ ] Keyboard shortcuts for common actions
- [ ] Settings persistence across browser sessions
- [ ] Help/documentation within extension
- [ ] Error reporting and graceful degradation

#### Testing Criteria:
- Extension feels responsive and professional
- New users can understand how to use it
- Settings survive browser restarts
- Graceful handling of unsupported scenarios
- No memory leaks during extended use

---

## Testing Strategy

### Per-Phase Testing
- **Unit Tests**: Effect parameter validation, audio graph correctness
- **Integration Tests**: Service worker ↔ offscreen ↔ popup communication
- **Manual Testing**: Real-world audio content (music, videos, games)
- **Performance Testing**: CPU/memory usage with multiple tabs

### Test Content Recommendations
- Simple sine wave generators for parameter validation
- Music streaming sites (YouTube, Spotify) for real-world testing
- Video content with speech for clarity testing
- Games or apps with dynamic audio for stress testing

### Browser Compatibility
- Chrome stable (primary target)
- Chrome Canary (early testing of new APIs)
- Consider Edge Chromium for broader reach

## Risk Mitigation

### Technical Risks
- **Audio Latency**: Use AudioWorklet, avoid ScriptProcessorNode
- **DRM Content**: Graceful fallback when capture fails
- **Performance**: Monitor CPU usage, provide bypass options
- **Browser Updates**: Test against Chrome Dev/Canary regularly

### User Experience Risks
- **Audio "Stealing"**: Clear UI indication when processing is active
- **Confusion**: Prominent "restore original audio" button
- **Tab Management**: Clear visual indication of which tabs are processed

## Success Metrics

### Technical Success
- Audio processing latency < 50ms
- CPU usage < 10% for 3 simultaneous processed tabs
- Zero audio dropouts during normal operation
- Stable memory usage over 1+ hour sessions

### User Experience Success
- Clear, intuitive effect controls
- Reliable start/stop functionality
- Obvious visual feedback for processing state
- Quick access to disable all processing

## Future Considerations

### Potential Enhancements
- Additional effects (reverb, compressor, EQ)
- MIDI controller support for real-time control
- Audio recording/export functionality
- VST plugin compatibility (long-term)

### Technical Evolution
- Migration from Tone.js to full custom AudioWorklet implementation
- WebAssembly for complex DSP algorithms
- WebCodecs API for additional audio format support
- Streaming audio to external devices