# New Effects Brainstorm

Proposed new effects that fill gaps in the current lineup. Each effect targets a sonic territory not covered by the existing 20 effects.

## Implementation Pattern

Each new effect requires changes in 3 places:

1. **`src/effects/<effectid>.ts`** — Config with id, name, description, parameters, defaultValues, sliderColor
2. **`src/effects/index.ts`** — Import and register in `EFFECTS` record
3. **`offscreen-effects.js`** — Three switch statements:
   - `createEffectChain()` — Call the `create<Effect>()` function
   - `updateEffectParams()` — Map param updates to live audio nodes
   - Third switch in param update path (around line 1973) — Additional param routing

Each `create<Effect>()` function receives `(context, params, tabLiveParams)` and must return `{ input, output }` nodes (or a chain thereof).

---

## 1. Tape Stop

**What it does:** Simulates pulling the power on a turntable — audio pitch-ramps down to silence, then optionally spins back up.

**Why it's new:** Nothing in the current set manipulates playback speed/rate. All pitch effects (pitch shifter, vibrato) are continuous modulations — this is a one-shot dramatic gesture.

**Suggested params:**
| Param | Label | Min | Max | Default | Unit |
|-------|-------|-----|-----|---------|------|
| stopTime | Stop Time | 0.1 | 3.0 | 1.0 | s |
| restartTime | Restart Time | 0.1 | 3.0 | 0.5 | s |
| mode | Mode | 0 | 2 | 0 | — |
| wet | Dry/Wet | 0 | 1 | 1.0 | % |

Mode: 0 = stop only, 1 = stop + restart, 2 = continuous loop (stop/restart cycle)

**Implementation approach:**
- Use a ScriptProcessor or AudioWorklet that writes incoming audio into a circular buffer
- Playback pointer reads from the buffer at a variable rate
- Rate ramps from 1.0 down to 0.0 over `stopTime` seconds (exponential curve sounds more natural)
- On restart, rate ramps from 0.0 back to 1.0 over `restartTime`
- The rate change naturally produces the pitch-drop effect
- In continuous/loop mode, use a timer to cycle stop/restart automatically

**Slider color suggestion:** `#2F4F4F` (Dark Slate Gray — vinyl/mechanical vibe)

---

## 2. Sidechain Pump — NEEDS WORK

**Status:** Implemented but not producing a noticeable effect. Needs more testing and improvement before release. The envelope follower approach (detecting kick/low-end energy to trigger ducking) may need tuning — possibly the sensitivity range is off, the filter isn't isolating kicks well enough, or the ducking gain isn't dramatic enough. Consider revisiting with:
- More aggressive default sensitivity
- Wider depth range or different gain curve
- Logging envelope values to debug detection
- Possibly a hybrid approach: envelope follower with an optional fixed-rate fallback

**What it does:** Envelope-following gain duck triggered by kick/low-end energy in the audio.

**Current params:** filterFreq (detection cutoff), sensitivity (trigger threshold), depth, attack, release, wet/dry

**Slider color:** `#FF1493` (Deep Pink)

---

## 3. Lo-Fi Tape

**What it does:** Simulates analog tape degradation — wow (slow pitch drift), flutter (fast pitch jitter), soft saturation, high-frequency rolloff, and optional tape hiss.

**Why it's new:** The bitcrusher is *digital* degradation (quantization artifacts, aliasing). This is *analog* degradation (warmth, drift, noise). Completely different sonic character — warm and nostalgic vs harsh and crunchy.

**Suggested params:**
| Param | Label | Min | Max | Default | Unit |
|-------|-------|-----|-----|---------|------|
| wowDepth | Wow | 0 | 1 | 0.3 | % |
| flutterRate | Flutter | 0.1 | 20 | 6.0 | Hz |
| saturation | Saturation | 0 | 1 | 0.4 | % |
| toneRolloff | Tone | 1000 | 12000 | 6000 | Hz |
| noise | Noise | 0 | 1 | 0.1 | % |
| wet | Dry/Wet | 0 | 1 | 0.8 | % |

**Implementation approach:**
- **Wow:** Slow LFO (0.3-0.5 Hz sine) modulating a delay line (same technique as vibrato, but much slower and subtler)
- **Flutter:** Faster LFO (~6 Hz) also modulating the delay line, summed with wow
- **Saturation:** WaveShaperNode with a soft tanh curve (gentler than the distortion effect's hard clipping modes). Curve: `Math.tanh(sample * (1 + saturation * 3))`
- **Tone rolloff:** Lowpass BiquadFilterNode at `toneRolloff` frequency
- **Noise:** A separate noise source (buffer of random samples) mixed in at low volume through a GainNode
- Chain: input → delay (wow+flutter) → waveshaper → lowpass → wet/dry mix → output

**Slider color suggestion:** `#D2691E` (Chocolate — warm analog tape vibe)

---

## 4. Shimmer Reverb

**What it does:** Reverb where the feedback path includes a pitch shifter (typically +12 semitones / octave up). Each reflection gets brighter and higher, creating ethereal, ambient swells.

**Why it's new:** The existing Reverb and Hall Reverb are straightforward convolution — they color the space but don't add harmonic content. Shimmer reverb generates new frequencies on each reflection, creating pad-like textures from any source.

**Suggested params:**
| Param | Label | Min | Max | Default | Unit |
|-------|-------|-----|-----|---------|------|
| decay | Decay | 0.5 | 10 | 4.0 | s |
| shimmer | Shimmer | 0 | 1 | 0.6 | % |
| interval | Interval | 0 | 3 | 0 | — |
| damping | Damping | 1000 | 12000 | 6000 | Hz |
| wet | Dry/Wet | 0 | 1 | 0.4 | % |

Interval: 0 = octave up (+12), 1 = fifth up (+7), 2 = octave down (-12), 3 = fifth down (-7)

**Implementation approach:**
- Can't use ConvolverNode for this since we need a feedback loop with pitch shifting
- Instead, build a feedback delay network:
  - Multiple delay lines (3-4) at staggered times (e.g., 0.03s, 0.047s, 0.071s — prime-ish ratios for diffusion)
  - Each delay feeds back through a gain (controls decay) and a pitch shifter
  - Pitch shifter: reuse the dual-delay-line technique from the existing pitch shifter effect
  - Damping filter (lowpass) in the feedback loop to prevent brightness buildup
  - Shimmer param controls how much of the feedback goes through the pitch shifter vs clean
- Alternatively, simpler approach: single long delay + pitch shift in feedback + convolver for diffusion
- The pitch shifting in the feedback is what makes frequencies rise with each reflection

**Slider color suggestion:** `#E6E6FA` (Lavender — ethereal/ambient)

---

## 5. Reverse Echo

**What it does:** Buffers short chunks of audio, reverses them, and plays them back with optional feedback. Creates the "sucking" pre-echo effect where you hear ghosts of audio before the original.

**Why it's new:** Nothing in the current set reverses audio. All delays/echoes play forward. Reverse playback is a fundamentally different sonic texture.

**Suggested params:**
| Param | Label | Min | Max | Default | Unit |
|-------|-------|-----|-----|---------|------|
| bufferTime | Buffer | 0.1 | 1.0 | 0.3 | s |
| feedback | Feedback | 0 | 0.9 | 0.3 | — |
| decay | Decay | 0 | 1 | 0.5 | % |
| wet | Dry/Wet | 0 | 1 | 0.5 | % |

**Implementation approach:**
- ScriptProcessor (or AudioWorklet) with a double-buffer scheme:
  - Buffer A records incoming audio for `bufferTime` seconds
  - While A records, Buffer B plays back its contents in reverse
  - When A fills up, swap roles — B starts recording, A plays reversed
  - Apply fade in/out at buffer boundaries to avoid clicks (short crossfade, ~5ms)
- Feedback: mix reversed output back into the recording buffer at `feedback` level
- Decay: apply amplitude envelope to the reversed playback (fade out toward the end)
- The double-buffer swap is the tricky part — need precise sample counting

**Slider color suggestion:** `#8B008B` (Dark Magenta — otherworldly/psychedelic)

---

## 6. Resonator

**What it does:** A bank of sharply tuned bandpass filters that make any input "sing" at musical pitches — like humming into piano strings with the sustain pedal held down.

**Why it's new:** Comb filter creates metallic resonance at one frequency. Simple filter is a general-purpose filter. This is a *chord* of tuned resonances that imposes musical pitch on unpitched material. Different concept entirely.

**Suggested params:**
| Param | Label | Min | Max | Default | Unit |
|-------|-------|-----|-----|---------|------|
| rootNote | Root Note | 36 | 84 | 60 | MIDI |
| chord | Chord | 0 | 4 | 0 | — |
| resonance | Resonance | 1 | 50 | 20 | Q |
| wet | Dry/Wet | 0 | 1 | 0.6 | % |

Chord: 0 = unison, 1 = octave, 2 = fifth, 3 = major, 4 = minor

**Implementation approach:**
- Create 3-5 parallel BiquadFilterNodes, each set to `bandpass` type
- Set frequencies based on root note MIDI → Hz (`440 * 2^((note-69)/12)`) plus chord intervals
- Chord intervals in semitones:
  - Unison: [0]
  - Octave: [0, 12]
  - Fifth: [0, 7]
  - Major: [0, 4, 7]
  - Minor: [0, 3, 7]
- High Q values (resonance param) make the filters ring, imposing pitch on any input
- Sum the parallel filter outputs and mix with dry signal
- When root note or chord changes, smoothly update filter frequencies

**Slider color suggestion:** `#FFD700` (Gold — musical/harmonic)

---

## 7. Granular Scatter

**What it does:** Randomly captures tiny grains of audio (5-50ms) and replays them with random pitch, pan, and timing variations. Creates clouds of scattered sonic fragments.

**Why it's new:** CD Skipper is *rhythmic* — it captures a fixed buffer and repeats it at a steady rate. Granular Scatter is *textural* — random grain selection, random playback parameters, creating ambient clouds rather than rhythmic stutters.

**Suggested params:**
| Param | Label | Min | Max | Default | Unit |
|-------|-------|-----|-----|---------|------|
| grainSize | Grain Size | 5 | 200 | 50 | ms |
| density | Density | 1 | 30 | 10 | grains/s |
| pitchRandom | Pitch Random | 0 | 1 | 0.3 | % |
| scatter | Scatter | 0 | 1 | 0.5 | % |
| wet | Dry/Wet | 0 | 1 | 0.6 | % |

**Implementation approach:**
- ScriptProcessor continuously records into a circular buffer (~2 seconds)
- A grain scheduler fires at `density` rate (with some randomization)
- Each grain:
  - Picks a random position from the circular buffer
  - Copies `grainSize` ms of audio
  - Creates a BufferSourceNode with that audio
  - Sets random playbackRate based on `pitchRandom` (0.5 to 2.0 range)
  - Connects through a StereoPannerNode at random pan position (`scatter` controls range)
  - Applies a Hann window envelope (fade in/out) to avoid clicks
  - Plays immediately, disconnects when done
- This creates an ongoing cloud of micro-sounds derived from the input
- Higher density = thicker texture, higher scatter = wider stereo field

**Slider color suggestion:** `#C0C0C0` (Silver — ambient/particle vibe)

---

## 8. Spectral Freeze

**What it does:** Captures a snapshot of the frequency spectrum at a single moment and sustains it as a continuous drone. Any audio becomes an ambient pad.

**Why it's new:** No existing effect does FFT-based resynthesis. This is a fundamentally different processing paradigm — working in the frequency domain rather than time domain.

**Suggested params:**
| Param | Label | Min | Max | Default | Unit |
|-------|-------|-----|-----|---------|------|
| freeze | Freeze | 0 | 1 | 0 | — |
| decay | Decay | 0 | 1 | 0.8 | % |
| brightness | Brightness | 0 | 1 | 0.5 | % |
| wet | Dry/Wet | 0 | 1 | 0.5 | % |

Freeze: 0 = passthrough (live), 1 = frozen (sustain current spectrum)

**Implementation approach:**
- AudioWorklet (preferred) or ScriptProcessor performing FFT:
  - Continuously analyze input with FFT (2048 or 4096 point)
  - When `freeze` toggles to 1, capture the current magnitude spectrum
  - While frozen, use inverse FFT to resynthesize audio from the frozen magnitudes with randomized phases (to avoid repetitive patterns)
  - Apply `brightness` as a spectral tilt (boost or cut high frequencies)
  - `decay` controls how slowly the frozen spectrum fades
- Alternative simpler approach: use an AnalyserNode to get frequency data, then drive a bank of oscillators at the detected frequencies/amplitudes
  - Less accurate but avoids AudioWorklet complexity
  - ~32-64 oscillators at FFT bin frequencies, amplitudes from AnalyserNode snapshot
- When `freeze` returns to 0, crossfade back to live audio

**Slider color suggestion:** `#00FFFF` (Cyan — frozen/icy)

---

## 9. Doppler Effect

**What it does:** Simulates a sound source flying past the listener — pitch shifts up on approach, down on departure, combined with volume and panning changes.

**Why it's new:** Auto Panner only modulates stereo position. This coordinates pitch + pan + volume together in a physically-modeled sweep, creating a distinctly different "fly-by" effect.

**Suggested params:**
| Param | Label | Min | Max | Default | Unit |
|-------|-------|-----|-----|---------|------|
| speed | Speed | 0.1 | 5 | 1.0 | Hz |
| distance | Distance | 0 | 1 | 0.5 | % |
| intensity | Intensity | 0 | 1 | 0.7 | % |
| wet | Dry/Wet | 0 | 1 | 0.8 | % |

**Implementation approach:**
- Model as a point source moving in a circle (or line) around the listener
- Use a single LFO (triangle or sine at `speed` Hz) to drive three synchronized parameters:
  - **Pitch:** Delay line with LFO-modulated delay time (same technique as vibrato). `intensity` scales the modulation depth. Produces pitch rise then fall.
  - **Pan:** StereoPannerNode modulated by same LFO shape — source moves left to right (or right to left)
  - **Volume:** GainNode modulated by an inverted version of the LFO — louder at closest approach, quieter at distance. `distance` controls how dramatic the volume change is.
- The key is that all three modulations are phase-locked to the same LFO cycle
- At high `speed`, becomes a complex modulation effect; at low `speed`, dramatic fly-bys

**Slider color suggestion:** `#FF6347` (Tomato — energy/motion)

---

## 10. Formant Shifter

**What it does:** Shifts vocal formants (resonant peaks that define vowel sounds) up or down without changing pitch. Makes voices sound like chipmunks, Darth Vader, or alien creatures.

**Why it's new:** Pitch Shifter changes the fundamental frequency. This reshapes the spectral envelope — the resonant peaks that make an "ah" sound different from an "ee" sound. Different sonic result entirely.

**Suggested params:**
| Param | Label | Min | Max | Default | Unit |
|-------|-------|-----|-----|---------|------|
| shift | Shift | -12 | 12 | 0 | semitones |
| mix | Mix | 0 | 1 | 0.5 | % |
| resonance | Resonance | 0.5 | 5 | 2.0 | Q |
| wet | Dry/Wet | 0 | 1 | 0.8 | % |

**Implementation approach:**
- Formant shifting is complex in pure Web Audio. Practical approach:
  - Bank of 4-5 bandpass filters at typical formant frequencies (300, 900, 2500, 3500, 4500 Hz)
  - To shift formants up: shift all filter center frequencies up by `shift` semitones
  - To shift formants down: shift all filter center frequencies down
  - Each filter extracts energy around a formant region and repositions it
  - `resonance` controls the Q of the formant filters (sharper = more vocal, broader = more natural)
  - `mix` crossfades between the formant-shifted signal and original
- This is an approximation — true formant shifting requires LPC analysis — but it's effective for the "chipmunk" and "deep voice" effects
- Alternative: use pitch shifting + inverse pitch shift on the spectral envelope (much more complex, would need AudioWorklet)

**Slider color suggestion:** `#DA70D6` (Orchid — voice/vocal transformation)

---

## Priority Order for Implementation

1. **Tape Stop** — Lowest complexity, highest "wow factor" per line of code
2. **Sidechain Pump** — Simple gain envelope scheduling, instantly recognizable sound
3. **Lo-Fi Tape** — Combines well-understood building blocks (LFO + delay + waveshaper + filter)
4. **Shimmer Reverb** — Builds on existing pitch shifter + delay techniques
5. **Reverse Echo** — Double-buffer scheme is moderately complex but well-documented technique
6. **Resonator** — Parallel bandpass filters are straightforward, musical result is interesting
7. **Doppler Effect** — Coordinates existing primitives, moderate complexity
8. **Granular Scatter** — Grain scheduling with BufferSourceNodes, more moving parts
9. **Formant Shifter** — Approximation approach is doable, but tuning the filter bank takes experimentation
10. **Spectral Freeze** — FFT resynthesis is the most complex, but also the most unique effect in the list
