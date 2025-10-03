# Effect Improvement Plan - Learning from Tone.js

## Overview

After discovering that Tone.js is incompatible with Chrome MV3 extensions due to AudioWorklet CSP restrictions, we're pivoting to study Tone.js algorithms and implement improved versions of our custom effects using pure Web Audio API.

## Research Methodology

### Phase 1: Algorithm Analysis
1. **Study Tone.js source code** for each effect we want to improve
2. **Identify key differences** between their algorithms and ours
3. **Document parameter ranges** and scaling that Tone.js uses
4. **Note any advanced techniques** we're not currently using

### Phase 2: Implementation Strategy
1. **Create improved versions** alongside existing effects
2. **Maintain compatibility** with our existing UI and message system
3. **Add A/B comparison capability** between original and improved versions
4. **Preserve all working functionality** while adding enhancements

## Target Effects for Improvement

### 1. BitCrusher
**Our Current Implementation:**
- Uses `ScriptProcessorNode` with custom bit-depth reduction
- Includes sample rate reduction (unique feature)
- Parameters: `bits` (1-16), `normalRange` (sample rate), `wet` (0-1)

**Tone.js Research Goals:**
- How does their bit-depth quantization differ?
- What's their parameter scaling approach?
- Any anti-aliasing or filtering techniques?
- How do they handle edge cases?

**Files to Study:**
- `node_modules/tone/build/esm/effect/BitCrusher.js`
- `node_modules/tone/build/esm/effect/BitCrusher.worklet.js` (worklet code)

### 2. Chorus
**Our Current Implementation:**
- Two delay lines with LFO modulation
- Simple sine wave LFOs at different rates
- Basic wet/dry mixing

**Tone.js Research Goals:**
- How many delay lines do they use?
- What's their LFO implementation strategy?
- How do they handle stereo processing?
- What are their parameter ranges and defaults?

**Files to Study:**
- `node_modules/tone/build/esm/effect/Chorus.js`

### 3. Distortion
**Our Current Implementation:**
- `WaveShaper` with custom curve generation
- Three distortion modes based on drive amount
- Tone filter (2kHz-10kHz lowpass)

**Tone.js Research Goals:**
- What waveshaping curve do they use?
- How do they handle oversampling?
- Any pre/post filtering techniques?
- Parameter scaling and range?

**Files to Study:**
- `node_modules/tone/build/esm/effect/Distortion.js`

### 4. Reverb
**Our Current Implementation:**
- Simple convolution with generated noise impulse
- Basic early reflection simulation
- Parameters: `roomSize`, `decay`, `wet`

**Tone.js Research Goals:**
- How do they generate impulse responses?
- What's their approach to early reflections?
- Any sophisticated room modeling?
- Pre-delay implementation?

**Files to Study:**
- `node_modules/tone/build/esm/effect/Reverb.js`
- `node_modules/tone/build/esm/effect/Freeverb.js` (alternative reverb)

## Research Questions

### Algorithm Questions
1. **Parameter Scaling:** How does Tone.js scale parameters for musical use?
2. **Anti-Aliasing:** What techniques prevent digital artifacts?
3. **Performance:** Any optimizations we should adopt?
4. **Edge Cases:** How do they handle extreme parameter values?

### Quality Questions
1. **Professional Sound:** What makes Tone.js effects sound "professional"?
2. **Parameter Ranges:** Why did they choose specific min/max values?
3. **Default Values:** What are their musical defaults and why?
4. **Interaction:** How do multiple parameters interact musically?

## Implementation Strategy

### Naming Convention
- Keep original effects as-is (e.g., `bitcrusher`)
- Add improved versions with `-v2` suffix (e.g., `bitcrusher-v2`)
- UI will show both: "Bitcrusher" and "Bitcrusher v2"

### Development Approach
1. **Research first** - Study Tone.js implementation thoroughly
2. **Document findings** - Note key insights and differences
3. **Implement improved version** - Apply learnings to new effect
4. **A/B test** - Compare original vs improved side by side
5. **Refine** - Adjust based on audio quality comparison

### Code Organization
```
src/effects/
  bitcrusher.ts         # Original config
  bitcrusher-v2.ts      # Improved config
  chorus.ts             # Original config
  chorus-v2.ts          # Improved config
  # etc...

offscreen-effects.js:
  createBitcrusher()    # Original implementation
  createBitcrusherV2()  # Improved implementation
  # etc...
```

## Success Metrics

### Audio Quality
- [ ] Improved versions sound more professional
- [ ] Better parameter response and musical scaling
- [ ] Reduced artifacts and improved clarity
- [ ] More musical default values

### Technical
- [ ] Maintain or improve performance
- [ ] No regressions in existing functionality
- [ ] Clean A/B comparison implementation
- [ ] Proper parameter mapping and scaling

### User Experience
- [ ] Clear differentiation in UI between versions
- [ ] Smooth switching between original and improved
- [ ] Intuitive parameter ranges
- [ ] Good musical defaults

## Research Tasks

### Immediate (This Session)
- [ ] Study Tone.js BitCrusher implementation
- [ ] Document key algorithmic differences
- [ ] Identify specific improvements to implement
- [ ] Plan BitCrusher v2 implementation strategy

### Next Steps
- [ ] Implement BitCrusher v2 based on research
- [ ] Update effect registry for dual versions
- [ ] Add UI support for v2 effects
- [ ] Test and refine BitCrusher v2

### Future Sessions
- [ ] Research and improve Chorus
- [ ] Research and improve Distortion
- [ ] Research and improve Reverb
- [ ] Consider additional effects from research

## Research Notes Section

*This section will be populated as we study each effect...*

---

## Key Insights

### BitCrusher Research ✅

**Tone.js Algorithm (Lines 17-21 of worklet):**
```javascript
const step = Math.pow(0.5, parameters.bits - 1);
const val = step * Math.floor(input / step + 0.5);
return val;
```

**Our Current Algorithm:**
```javascript
const step = Math.pow(2, tabLiveParams.bits - 1);
const crushed = Math.round(lastSample * step) / step;
```

**Key Differences:**
1. **Step Calculation:**
   - **Tone.js:** `Math.pow(0.5, bits - 1)` → Creates smaller steps for higher bit values
   - **Our:** `Math.pow(2, bits - 1)` → Creates larger steps for higher bit values
   - **Impact:** Opposite behavior! Their algorithm is more intuitive (higher bits = less distortion)

2. **Quantization Method:**
   - **Tone.js:** `step * Math.floor(input / step + 0.5)` → More precise rounding
   - **Our:** `Math.round(lastSample * step) / step` → Basic rounding
   - **Impact:** Tone.js approach may have better numerical precision

3. **Parameter Defaults:**
   - **Tone.js:** Default `bits: 4`, range 1-16, with 12-bit fallback
   - **Our:** Default `bits: 8`, range 1-16
   - **Impact:** Their default is more aggressive (more distortion)

4. **Sample Rate Reduction:**
   - **Tone.js:** Pure bit-crushing only
   - **Our:** Combines bit-crushing + sample rate reduction (unique feature)
   - **Impact:** Our approach is more comprehensive but less focused

5. **Dry/Wet Mixing:**
   - **Tone.js:** Uses CrossFade component with `wet` parameter (0-1)
   - **Our:** Manual wet/dry mix: `input * (1 - wet) + crushed * wet`
   - **Impact:** Similar result, different implementation

**Improvements to Implement:**
1. ✅ **Fix step calculation** - Use Tone.js approach for intuitive parameter behavior
2. ✅ **Improve quantization** - Use their more precise floor+0.5 method
3. ✅ **Better defaults** - Consider 4-bit default for more obvious effect
4. ✅ **Keep our sample rate reduction** - This is a unique and valuable feature
5. ✅ **Professional parameter scaling** - Match their 1-16 range with proper behavior

### Chorus Research
*Findings will go here...*

### Distortion Research
*Findings will go here...*

### Reverb Research
*Findings will go here...*