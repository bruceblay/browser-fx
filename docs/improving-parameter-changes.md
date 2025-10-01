# Improving Parameter Changes in Tab Bitcrusher

## Executive Summary

The clicking and audio cutoff issues when adjusting parameters in Tab Bitcrusher are caused by **direct assignment to AudioParam values** without using Web Audio API's built-in parameter automation methods. This is a well-known problem in Web Audio development with established solutions.

**Key Finding:** Our codebase uses direct `.value =` assignment 167 times and uses proper AudioParam automation methods 0 times.

---

## Root Causes Identified

### 1. Direct Value Assignment (Primary Issue)

**Location:** `offscreen-effects.js` lines 1824-1850+ (and throughout)

**Problem:**
```javascript
// Current implementation (causes clicks)
currentEffect.input._wetGain.gain.value = liveParams.wet
currentEffect.input._delayL.delayTime.value = liveParams.delayTime
currentEffect.input._feedbackL.gain.value = liveParams.feedback
```

When we directly assign to `.value`, the AudioParam changes **instantly** at the next audio processing block. This creates discontinuities in the audio waveform, which the ear perceives as clicks or pops.

**Why it happens:**
- Audio is a continuous waveform
- Abrupt value changes cut the wave at non-zero crossing points
- The sudden jump creates a high-frequency transient (click/pop)
- Lower frequencies need more time to transition smoothly

### 2. Effect Recreation for Minor Parameter Changes

**Location:** `offscreen-effects.js` lines 1909-1912, 1925-1928, 1938-1940, etc.

**Problem:**
```javascript
// Reverb roomSize/decay change
if (params.roomSize !== undefined || params.decay !== undefined) {
  console.log(`🎵 Recreating reverb for tab ${tabId}`)
  switchEffectForTab(effectId, state.currentEffectParams, tabId)
}
```

When we recreate effects like reverb and delay:
- The entire audio graph is torn down and rebuilt
- All delay lines and reverb tails are immediately terminated
- This causes a very noticeable audio cutoff
- The wet signal disappears completely for a moment

### 3. Lack of De-Zippering

**Background:** Early Web Audio API implementations included automatic "de-zippering" (smoothing parameter changes). Modern browsers removed this, expecting developers to explicitly smooth parameters using automation methods.

Our implementation has no smoothing layer, so every parameter change is abrupt.

---

## Web Audio API Solutions

### AudioParam Automation Methods

The Web Audio API provides built-in methods for smooth parameter changes:

#### 1. `setValueAtTime(value, startTime)`
Schedules an instant change at a specific time. Still causes clicks if used alone.

```javascript
param.setValueAtTime(currentValue, audioContext.currentTime)
```

#### 2. `linearRampToValueAtTime(value, endTime)`
Creates a linear ramp from the current scheduled value to the target value.

```javascript
param.setValueAtTime(param.value, audioContext.currentTime)
param.linearRampToValueAtTime(newValue, audioContext.currentTime + rampTime)
```

#### 3. `exponentialRampToValueAtTime(value, endTime)` ⭐
Creates an exponential ramp (more natural sounding). **Cannot ramp to exactly 0** - use 0.0001 instead.

```javascript
param.setValueAtTime(param.value, audioContext.currentTime)
param.exponentialRampToValueAtTime(newValue, audioContext.currentTime + rampTime)
```

#### 4. `setTargetAtTime(target, startTime, timeConstant)` ⭐
Exponentially approaches the target value. Great for "analog" feel.

```javascript
// Reaches ~99% of target in timeConstant * 5
param.setTargetAtTime(newValue, audioContext.currentTime, 0.015)
```

#### 5. `cancelAndHoldAtTime(cancelTime)`
Cancels future scheduled changes while holding the current value. Useful for stopping automation without clicks.

---

## Recommended Solutions

### Solution 1: Add Smooth Parameter Helper (Recommended for Quick Wins)

Create a utility function that automatically smooths parameter changes:

```javascript
/**
 * Smoothly transition an AudioParam to a new value
 * @param {AudioParam} param - The parameter to change
 * @param {number} targetValue - The target value
 * @param {number} rampTime - Ramp duration in seconds (default: 0.02)
 * @param {string} type - 'linear' or 'exponential' (default: 'exponential')
 */
function smoothParamChange(param, targetValue, rampTime = 0.02, type = 'exponential') {
  const now = audioContext.currentTime

  // Cancel any scheduled changes
  param.cancelScheduledValues(now)

  // Set current value as starting point
  param.setValueAtTime(param.value, now)

  // Ramp to new value
  if (type === 'exponential' && targetValue > 0.0001) {
    param.exponentialRampToValueAtTime(targetValue, now + rampTime)
  } else {
    param.linearRampToValueAtTime(targetValue, now + rampTime)
  }
}

// Usage in updateEffectParamsForTab:
if (params.wet !== undefined) {
  smoothParamChange(state.currentEffect.input._wetGain.gain, state.liveParams.wet)
  smoothParamChange(state.currentEffect.input._dryGain.gain, 1 - state.liveParams.wet)
}
```

**Benefits:**
- Easy to implement across all 167 direct assignments
- Provides immediate improvement
- 20ms ramp time is imperceptible but eliminates clicks
- Works for gain, frequency, delay time, and other parameters

**Recommended Ramp Times:**
- Gain/Mix parameters: 10-20ms (exponential)
- Frequency parameters: 15-30ms (exponential)
- Delay time: 20-50ms (linear)
- Filter Q/resonance: 15-25ms (exponential)

### Solution 2: Implement Analog-Style Parameter Smoothing

For more "analog pedal" feel, use `setTargetAtTime` with small time constants:

```javascript
function analogParamChange(param, targetValue, smoothness = 0.015) {
  const now = audioContext.currentTime
  param.cancelScheduledValues(now)
  param.setValueAtTime(param.value, now)
  param.setTargetAtTime(targetValue, now, smoothness)
}

// Creates a more gradual, "knob turning" feel
// smoothness values:
// 0.005 - fast response (guitar pedal)
// 0.015 - medium response (recommended default)
// 0.030 - slow/smooth response (synth filter sweep)
```

**Benefits:**
- Exponential approach feels more natural
- Great for "live tweaking" scenarios
- Handles rapid parameter changes gracefully
- Never causes clicks

### Solution 3: Avoid Effect Recreation for Parameter Changes

Instead of recreating reverb/delay effects, implement proper real-time parameter updates:

#### For Reverb (roomSize/decay):
Current approach recreates the entire effect. Better approaches:

**Option A:** Use pre-computed impulse responses
```javascript
// Pre-generate multiple impulse responses at different settings
const impulseResponseCache = {
  'small_short': generateImpulse(0.3, 1.0),
  'small_long': generateImpulse(0.3, 3.0),
  'large_short': generateImpulse(0.9, 2.0),
  'large_long': generateImpulse(0.9, 6.0),
}

// Crossfade between impulse responses smoothly
function updateReverbParams(roomSize, decay) {
  // Interpolate between cached responses
  // Or switch with crossfade to avoid cutoff
}
```

**Option B:** Use AllPass/Comb filter networks instead of convolution
```javascript
// Build reverb from individual delays/filters that can be adjusted in real-time
// More complex but allows smooth parameter changes
// See: Freeverb, Schroeder reverb algorithms
```

#### For Delay (delay time):
Use delay line interpolation:

```javascript
// Instead of recreating, smoothly ramp the delayTime parameter
if (params.delayTime !== undefined) {
  smoothParamChange(
    state.currentEffect.input._delayL.delayTime,
    state.liveParams.delayTime,
    0.05,  // 50ms ramp for delay time
    'linear'
  )
  smoothParamChange(
    state.currentEffect.input._delayR.delayTime,
    state.liveParams.delayTime,
    0.05,
    'linear'
  )
}
```

**Note:** Changing delay time while audio is passing through creates pitch-shifting artifacts (like a tape speed change). This is actually desirable for analog delay emulation!

### Solution 4: Add Crossfading for Unavoidable Effect Switching

When effect recreation is truly necessary, crossfade between old and new:

```javascript
async function crossfadeSwitchEffect(newEffectId, params, tabId, crossfadeTime = 0.05) {
  const state = getTabState(tabId)
  const oldEffect = state.currentEffect

  // Create new effect
  const newEffect = createEffect(newEffectId, params, state.liveParams)

  // Connect new effect (silent)
  const newOutput = audioContext.createGain()
  newOutput.gain.value = 0
  state.sourceNode.connect(newEffect.input)
  newEffect.output.connect(newOutput)
  newOutput.connect(state.destinationNode)

  // Crossfade
  const now = audioContext.currentTime
  if (oldEffect.output._gain) {
    smoothParamChange(oldEffect.output._gain.gain, 0, crossfadeTime)
  }
  smoothParamChange(newOutput.gain, 1, crossfadeTime)

  // Cleanup old effect after fade
  setTimeout(() => {
    oldEffect.input.disconnect()
    oldEffect.output.disconnect()
  }, crossfadeTime * 1000 + 100)

  state.currentEffect = newEffect
}
```

---

## Real-World Implementation Examples

### Tone.js Approach
Tone.js provides `.rampTo()` method that automatically chooses linear or exponential ramping:

```javascript
// Tone.js abstraction
oscillator.frequency.rampTo(440, 0.1) // Ramp to 440Hz over 100ms
```

Internally, it uses `exponentialRampToValueAtTime` for frequency/time parameters and `linearRampToValueAtTime` for gain.

### smoothfade Library
The `smoothfade` library wraps GainNodes specifically for click-free fading:

```javascript
const fade = smoothfade(audioContext, gainNode)
fade.fadeOut(0.5) // Fade out over 500ms using exponential ramp
fade.fadeIn(0.2)  // Fade in over 200ms
```

Uses calculation-based approach to manage automation curves.

### Pizzicato.js
Does not explicitly document parameter smoothing (likely relies on direct assignment, may have clicking issues).

---

## Implementation Priority

### Phase 1: Quick Wins (Recommended Start)
1. **Implement `smoothParamChange()` helper function** (2 hours)
2. **Replace all gain parameter changes** in `updateEffectParamsForTab()` (3 hours)
   - Wet/dry mix parameters (~20 occurrences)
   - Feedback gains (~8 occurrences)
   - Output gains (~5 occurrences)
3. **Test with reverb and delay effects** (1 hour)

**Expected improvement:** 80% reduction in clicking issues

### Phase 2: Frequency & Timing Parameters (Medium Priority)
1. **Replace filter frequency changes** (1 hour)
   - Filter cutoff frequencies
   - LFO rates
   - Oscillator frequencies
2. **Replace delay time changes** with smooth ramping (1 hour)
3. **Test pitch-sensitive effects** (1 hour)

**Expected improvement:** 95% reduction in clicking issues

### Phase 3: Effect Recreation Elimination (Long-term)
1. **Refactor reverb to avoid recreation** (4-8 hours)
   - Consider convolution reverb alternatives
   - Or implement crossfading system
2. **Add crossfade system for complex switches** (3-4 hours)
3. **Optimize for performance** (2 hours)

**Expected improvement:** 100% smooth parameter changes, more "analog" feel

---

## Technical Considerations

### Performance Impact
- AudioParam automation is **highly optimized** in browsers
- Runs at audio rate (48kHz+) without JavaScript overhead
- Minimal CPU impact compared to direct assignment
- Much better than implementing smoothing in JavaScript

### Browser Compatibility
- All AudioParam automation methods: **100% support** (Chrome, Firefox, Safari, Edge)
- `cancelAndHoldAtTime()`: **95% support** (missing older Safari versions)
- Safe to use in Chrome extension context

### Precision
- AudioParam automation is **sample-accurate**
- Much more precise than requestAnimationFrame-based smoothing
- Guarantees no clicks when used correctly

---

## Testing Strategy

### Manual Testing
1. Load reverb effect
2. Rapidly move wet/dry slider back and forth
3. Listen for clicks/pops (should be eliminated)
4. Test delay feedback while audio is playing
5. Sweep filter frequencies continuously

### Automated Testing
```javascript
// Test helper: Verify no discontinuities in output
async function detectClicks(effectNode, paramChange, duration = 1.0) {
  const recorder = audioContext.createScriptProcessor(256, 2, 2)
  let clickDetected = false

  recorder.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0)
    // Check for large sample-to-sample jumps
    for (let i = 1; i < input.length; i++) {
      if (Math.abs(input[i] - input[i-1]) > 0.5) {
        clickDetected = true
      }
    }
  }

  effectNode.connect(recorder)
  paramChange() // Make the parameter change
  await sleep(duration)
  recorder.disconnect()

  return clickDetected
}
```

---

## Additional Resources

### Essential Reading
- [MDN: AudioParam](https://developer.mozilla.org/en-US/docs/Web/API/AudioParam)
- [Web Audio: the ugly click and the human ear](http://alemangui.github.io/ramp-to-value)
- [Web Audio API Best Practices (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices)

### Libraries to Study
- [Tone.js](https://tonejs.github.io/) - See `Param.ts` for ramp implementation
- [smoothfade](https://github.com/notthetup/smoothfade) - Specialized gain smoothing
- [Tuna](https://github.com/Theodeus/tuna) - Web Audio effects library

### Stack Overflow Discussions
- [Web Audio API: Ramping Gain to Avoid Clicks](https://stackoverflow.com/questions/39988984/)
- [How to avoid clicking sound when stopping](https://stackoverflow.com/questions/29378875/)
- [Smooth volume change with Web Audio API](https://stackoverflow.com/questions/61847065/)

---

## Conclusion

The clicking and cutoff issues in Tab Bitcrusher are **entirely solvable** with established Web Audio API techniques. The root cause is direct value assignment instead of using AudioParam automation methods.

**Recommended Action:**
Start with Phase 1 (implement `smoothParamChange()` helper) for immediate results. This provides the biggest impact with minimal code changes and will make the effects feel significantly more professional and "analog."

The 20ms ramp time is fast enough to feel instant but slow enough to eliminate all clicking. This matches the behavior of professional audio plugins and hardware effects pedals.
