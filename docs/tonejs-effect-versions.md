# Tone.js Effect Versions - Implementation Roadmap

## Overview

This document outlines the differences between our custom Web Audio API effects and Tone.js implementations, and provides a roadmap for implementing Tone.js versions alongside our custom ones for A/B comparison.

## Effect Comparison Analysis

### BitCrusher

**Our Implementation (`offscreen-effects.js:122-156`)**
- Uses `ScriptProcessorNode` with custom `onaudioprocess` callback
- Manual bit-depth reduction: `Math.round(lastSample * step) / step`
- **Unique feature:** Sample rate reduction via counter logic
- Real-time parameter updates via shared `liveParams`
- Parameters: `bits` (1-16), `normalRange` (sample rate reduction), `wet` (0-1)

**Tone.js Implementation**
- Uses modern `AudioWorkletNode` for better performance and stability
- Professional-grade bit-depth quantization algorithm
- Range: 1-16 bits (no sample rate reduction component)
- Built-in wet/dry mixing and effect chaining

**Sound Difference:** Our version combines bit-crushing with sample rate reduction creating a more aggressive, "vintage" digital distortion. Tone.js focuses purely on bit-depth reduction with cleaner processing.

### Chorus

**Our Implementation (`offscreen-effects.js:284-362`)**
- Two delay lines with independent LFO modulation
- Simple sine wave LFOs at different frequencies (rate * 1.0 and rate * 1.3)
- Delay time in milliseconds (2-20ms range)
- Manual stereo processing with basic wet/dry mix

**Tone.js Implementation**
- More sophisticated stereo processing with spread parameter
- Built-in transport synchronization
- Multiple LFO waveform options (sine, square, triangle, sawtooth)
- Professional parameter scaling designed by audio engineers

**Sound Difference:** Similar core effect, but Tone.js has better stereo imaging, smoother modulation, and more musical parameter ranges.

### Distortion

**Our Implementation (`offscreen-effects.js:209-282`)**
- Uses `WaveShaper` with custom distortion curve generation
- Dynamic curve based on drive amount (1-51x drive)
- Three distortion modes based on amount: soft clipping, harder clipping, hard limiting
- Tone filter (2kHz-10kHz lowpass)

**Tone.js Implementation**
- Uses `WaveShaper` with professional distortion algorithm
- Oversampling options ("none", "2x", "4x")
- Single distortion curve optimized for musical applications
- Built-in anti-aliasing

**Sound Difference:** Our version has more aggressive, varied distortion modes. Tone.js focuses on cleaner, more predictable musical distortion.

### Reverb

**Our Implementation (`offscreen-effects.js:158-207`)**
- Simple convolution with generated noise impulse response
- Basic early reflection simulation
- Parameters: `roomSize`, `decay`, `wet`

**Tone.js Implementation**
- Professional impulse response generation
- Pre-delay parameter for realistic room simulation
- More sophisticated early reflection modeling
- Better tail characteristics

**Sound Difference:** Our version is simpler and more "lo-fi". Tone.js sounds more realistic and professional.

## Implementation Roadmap

### Phase 1: Setup and Infrastructure

#### ✅ Tasks Completed
- [x] Document effect differences and analysis

#### 🔲 Tasks To Complete

1. **Install and Configure Tone.js**
   - Verify Tone.js is properly imported in offscreen document
   - Test basic Tone.js functionality in offscreen context
   - Ensure compatibility with Chrome extension environment

2. **Update Effect Registry System**
   - Modify `src/effects/index.ts` to support dual versions
   - Add naming convention for Tone.js effects (e.g., "bitcrusher-tonejs")
   - Update effect configuration structure to handle both versions

3. **Create Tone.js Effect Configurations**
   - Create new config files: `src/effects/bitcrusher-tonejs.ts`
   - Create new config files: `src/effects/chorus-tonejs.ts`
   - Create new config files: `src/effects/distortion-tonejs.ts`
   - Create new config files: `src/effects/reverb-tonejs.ts`
   - Match parameter ranges and defaults to Tone.js specs

### Phase 2: Effect Implementation

4. **Implement Tone.js BitCrusher**
   - Add `createToneJsBitcrusher()` function to offscreen-effects.js
   - Initialize Tone.js AudioContext integration
   - Map our parameter structure to Tone.js BitCrusher
   - Test against our custom version

5. **Implement Tone.js Chorus**
   - Add `createToneJsChorus()` function
   - Handle Tone.js Chorus parameter mapping
   - Implement proper effect cleanup
   - Test stereo spread and modulation differences

6. **Implement Tone.js Distortion**
   - Add `createToneJsDistortion()` function
   - Configure oversampling options
   - Map distortion amount parameter
   - Compare distortion characteristics

7. **Implement Tone.js Reverb**
   - Add `createToneJsReverb()` function
   - Handle impulse response generation
   - Implement pre-delay parameter
   - Test decay and room size differences

### Phase 3: UI and Integration

8. **Update Effect Selection UI**
   - Modify popup effect dropdown to show both versions
   - Add "(tone.js)" suffix to Tone.js versions
   - Ensure proper effect ID routing
   - Update effect switching logic

9. **Update Message Handling**
   - Extend `createEffect()` switch statement for Tone.js versions
   - Update `switchEffectForTab()` to handle new effect IDs
   - Ensure parameter updates work for both versions
   - Test real-time parameter changes

10. **Implement A/B Testing Features**
    - Add UI controls for quick switching between versions
    - Consider adding "Compare" button to switch between custom/Tone.js
    - Add visual indicators showing which version is active
    - Implement proper audio crossfading for seamless switching

### Phase 4: Testing and Optimization

11. **Performance Testing**
    - Compare CPU usage between custom and Tone.js versions
    - Test memory allocation differences
    - Measure audio latency differences
    - Profile AudioWorklet vs ScriptProcessor performance

12. **Audio Quality Testing**
    - A/B test each effect pair with various audio sources
    - Document sonic differences and characteristics
    - Test parameter ranges and responsiveness
    - Verify no audio artifacts or glitches

13. **Cross-browser Testing**
    - Test Tone.js effects in Chrome, Firefox, Edge
    - Verify AudioWorklet support across browsers
    - Test fallback behavior if AudioWorklet unavailable
    - Document any browser-specific differences

### Phase 5: Documentation and Polish

14. **Update Documentation**
    - Document new effect IDs and parameter mappings
    - Update README with A/B testing instructions
    - Add troubleshooting guide for Tone.js integration
    - Document performance characteristics

15. **Code Cleanup**
    - Remove any unused imports or functions
    - Optimize effect creation and cleanup routines
    - Add proper error handling for Tone.js initialization
    - Ensure consistent coding style

## Technical Considerations

### Tone.js Integration Challenges

1. **AudioContext Sharing**
   - Tone.js expects to manage its own AudioContext
   - Need to configure Tone.js to use our existing context
   - May need to call `Tone.setContext(audioContext)` early

2. **Effect Lifecycle Management**
   - Tone.js effects have `.dispose()` methods for cleanup
   - Need to properly dispose of effects when switching
   - Handle Tone.js effect start/stop lifecycle

3. **Parameter Mapping**
   - Tone.js uses different parameter names/ranges
   - Need translation layer between our UI and Tone.js effects
   - Some parameters may not have direct equivalents

4. **Chrome Extension Security**
   - AudioWorklet requires HTTPS in production
   - May need fallbacks for development environment
   - Ensure CSP compatibility with Tone.js

### Expected Benefits

1. **Professional Sound Quality**
   - More polished, musical-sounding effects
   - Better anti-aliasing and artifact reduction
   - Professional parameter scaling

2. **Performance Improvements**
   - AudioWorklet-based processing (where supported)
   - Better CPU utilization
   - Reduced audio thread blocking

3. **Feature Completeness**
   - Access to Tone.js ecosystem features
   - Professional effect algorithms
   - Better real-time parameter control

### Success Metrics

- [ ] All four Tone.js effects implemented and functional
- [ ] A/B switching works seamlessly without audio dropouts
- [ ] Performance equals or exceeds custom implementations
- [ ] User can clearly hear differences between versions
- [ ] No regressions in existing custom effects functionality
- [ ] Documentation is complete and accurate

## Next Steps

1. Start with BitCrusher as the proof of concept
2. Verify Tone.js integration works in offscreen document
3. Implement basic A/B switching UI
4. Gradually add remaining effects
5. Conduct thorough testing and optimization

This roadmap provides a systematic approach to implementing Tone.js versions alongside our custom effects, enabling direct A/B comparison and giving users the choice between different sonic characteristics.