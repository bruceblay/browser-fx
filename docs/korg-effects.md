# Korg Kaoss Pad Effects - Web Audio Implementation Guide

This document catalogs standalone effects from the Korg Kaoss Pad series, focusing on unique effects suitable for Web Audio API implementation (excluding combo/multi-effects).

## Overview
The Korg Kaoss Pad is a touchpad-based effects processor and sampler. Unlike traditional pedals, it uses an X/Y pad interface for real-time effect parameter control. We're focusing on **standalone effects** that can be implemented independently, not combination effects.

---

## Kaoss Pad Models & Program Counts
- **KP-1** (Original): 60 effects
- **KP-2**: Enhanced effects set
- **KP3**: 128 effects programs
- **KP3+**: 150 effects programs (108 from KP3 + 42 new)

---

## Effects by Category (KP3/KP3+)

### ✅ 1. FILTERS (20 programs)
**Web Audio: HIGHLY FEASIBLE**

**Notable Effects:**
1. **FLt.1 Morphing Filter** - Filter that morphs between types
2. **FLt.2 Low Pass Filter** - Classic LPF
3. **FLt.3 High Pass Filter** - Classic HPF
4. **FLt.4 Band Pass Filter** - BPF
5. **FLt.5 72dB/oct LPF** - Steep slope LPF
6. **FLt.12 Vowel Filter** - Formant filter (vocal sounds)
7. **FLt.13 Telephone Filter** - Bandpass for "phone" sound
8. **FLt.14 Radio Filter** - Tuning radio effect
9. **FLt.15 Radio Isolator** - Isolates frequency bands
10. **FLt.16 Center Canceler** - Removes center (vocal removal)
11. **FLt.17 Mid Cut Filter** - Scooped mids
12. **FLt.18 Isolator** - DJ-style 3-band isolator
13. **FLt.19 Isolator & Distortion** *(combo - separate if wanted)*
14. **FLt.20 Isolator & Delay** *(combo - separate if wanted)*

**Implementation:** BiquadFilterNode with various types, Q values, and slopes

**Unique Ideas:**
- **Vowel Filter**: Chain multiple bandpass filters at vowel formant frequencies (a/e/i/o/u)
- **Radio Isolator**: 3-band EQ with kill switches
- **Morphing Filter**: Crossfade between different filter types

---

### ✅ 2. MODULATION (18 programs)
**Web Audio: HIGHLY FEASIBLE**

**Notable Effects:**
1. **Mod.1 Vinyl Break** - Vinyl stop/slowdown effect
2. **Mod.2 Break Reverb** - Reverb with vinyl break
3. **Mod.3 Jet +** - Jet flanger sweep up
4. **Mod.4 Jet -** - Jet flanger sweep down
5. **Mod.5 Manual Phaser** - Hand-controlled phaser
6. **Mod.6 Talk Filter** - Vocal formant modulation
7. **Mod.7 Digi Talk** - Digital vocoder-like effect
8. **Mod.8 Ducking Compressor** - Sidechain-style ducking
9. **Mod.9 Compressor** - Standard compressor
10. **Md.10 Low Compressor** - Bass-focused compression
11. **Md.11 Decimator** - Sample rate reduction (bitcrusher)
12. **Md.12 Decimator & HPF** *(combo)*
13. **Md.13 Fuzz Distortion** - Fuzz effect
14. **Md.14 Broken Modulation** - Glitchy modulation
15. **Md.15 Ring Mod & HPF** - Ring modulator *(combo)*
16. **Md.16 Pitch Shifter & HPF** *(combo)*
17. **Md.17 Mid Pitch Shifter** - Pitch shift center only
18. **Md.18 Pitch Shifter & Delay** *(combo)*

**Implementation:**
- **Vinyl Break**: Variable playback rate (detune)
- **Decimator**: Sample rate reduction (we already have this!)
- **Talk Filter**: Moving bandpass filter with formant peaks
- **Ring Modulator**: Amplitude modulation with carrier oscillator
- **Ducking Compressor**: DynamicsCompressorNode with sidechain

**Unique Ideas:**
- **Vinyl Break**: Gradually reduce playback rate + add filter + crackle
- **Broken Modulation**: Random/glitchy LFO patterns

---

### ✅ 3. LFO EFFECTS (27 programs)
**Web Audio: HIGHLY FEASIBLE**

**Notable Effects:**
1. **LFO.1 Jag Filter** - Jagged/stepped filter sweep
2. **LFO.2 LFO LPF** - LFO-modulated lowpass
3. **LFO.3 LFO HPF** - LFO-modulated highpass
4. **LFO.4 LFO BPF+** - LFO-modulated bandpass
5. **LFO.6 Infinite LFO HPF+** - Self-oscillating filter
6. **LFO.7 Random LFO LPF** - Random filter modulation
7. **LFO.8 Random LFO HPF+** - Random highpass mod
8. **LFO.9 Yoi Yoi** - DJ "rewind" effect
9. **LF.10 Flanger** - Classic flanger
10. **LF.11 Deep Flanger** - Intense flanging
11. **LF.12 Mid Flanger** - Flanger on mid frequencies
12. **LF.15 Infinite LFO Flanger** - Self-oscillating flanger
13. **LF.16 Phaser** - Classic phaser
14. **LF.17 Mid Phaser** - Phaser on mids
15. **LF.19 Step Phaser** - Stepped/quantized phaser
16. **LF.20 Auto Pan** - Stereo auto-panning
17. **LF.21 Mid Auto Pan** - Pan mid frequencies only
18. **LF.22 Slicer** - Rhythmic gating (tremolo gate)
19. **LF.23 Mid Slicer** - Slice mid frequencies
20. **LF.26 Audio Gate & LPF** - Gate + filter
21. **LF.27 Audio Gate & HPF** - Gate + filter

**Implementation:**
- LFO: OscillatorNode (sine, square, triangle, sawtooth, random)
- Modulation targets: filter frequency, gain, pan, delay time
- **Step/Quantized**: Sample-and-hold LFO
- **Slicer**: Square wave LFO controlling gain (gate)

**Unique Ideas:**
- **Yoi Yoi**: Rapid pitch bend + reverse effect
- **Jag Filter**: Stepped LFO (sample-and-hold)
- **Random LFO**: Noise-based modulation
- **Slicer**: Rhythmic gate synced to tempo

---

### ✅ 4. DELAY EFFECTS (17 programs)
**Web Audio: HIGHLY FEASIBLE**

**Notable Effects:**
1. **dLY.1 Delay** - Standard delay
2. **dLY.2 Echo Break** - Delay with vinyl break
3. **dLY.3 Reverse Echo Break** - Reverse + break delay
4. **dLY.4 LoFi Echo Break** - Degraded delay quality
5. **dLY.5 One Delay** - Single repeat only
6. **dLY.6 Tape Echo** - Tape-style with modulation
7. **dLY.7 Dub Echo** - Dub reggae echo (filtered feedback)
8. **dLY.8 Feedback Echo** - High feedback, runaway delay
9. **dLY.9 Smooth Delay** - Interpolated delay
10. **dL.10 Low Cut Delay** - Delay with HPF in feedback
11. **dL.11 Ping Pong Delay** - Stereo bouncing
12. **dL.12 LCR Delay** - Left-Center-Right delay
13. **dL.13 3 Band Delay** - Multi-band delay
14. **dL.14 Reverse Delay Mix** - Reverse + forward
15. **dL.15 3 Band Reverse Delay** - Reverse per band

**Implementation:**
- DelayNode + feedback loop
- **Tape Echo**: Add LFO modulation to delay time (wow/flutter)
- **Dub Echo**: Lowpass filter in feedback path
- **Ping Pong**: Alternate delay taps left/right
- **Reverse**: Record buffer, play backwards

**Unique Ideas:**
- **Echo Break**: Delay with gradually slowing repeats
- **LoFi Echo**: Bitcrusher in delay feedback path
- **3 Band Delay**: Split into low/mid/high, different delay times

---

### ⚠️ 5. REVERB EFFECTS (8 programs)
**Web Audio: FEASIBLE (ConvolverNode)**

**Notable Effects:**
- Reverb types: Room, Hall, Plate, Spring
- **dL.16 Gate Reverb & Delay** - Gated reverb

**Implementation:**
- ConvolverNode with impulse responses
- **Gate Reverb**: Hard cut reverb tail with envelope

---

### ⚠️ 6. GRAIN SHIFTER (6 programs)
**Web Audio: CHALLENGING**

**Description:** Freezes tiny pieces of sound and repeats/manipulates them

**Implementation Notes:**
- Granular synthesis: Chop audio into tiny grains (10-100ms)
- Requires custom audio processing (AudioWorklet)
- CPU intensive but creates unique textures

**Effect Ideas:**
- Freeze effect (infinite sustain of grain)
- Time stretching without pitch change
- Textural/ambient effects

---

### 🎵 7. LOOPER EFFECTS (20 programs, 13 distinct)
**Web Audio: FEASIBLE (Buffer Recording)**

**Notable Effects:**
- Real-time loop recording
- Loop slicing
- Reverse looping

**Implementation:**
- AudioBuffer recording via ScriptProcessor or AudioWorklet
- Playback with BufferSourceNode
- Not a typical "effect" for our extension use case

---

### 🎤 8. SAMPLER/VOCODER (11 programs)
**Web Audio: VARIES**

**Samplers (7):** Buffer recording/playback
**Vocoders (4):** Analyze input, resynthesize with carrier

**Implementation Notes:**
- **Sampler**: Buffer-based (like looper)
- **Vocoder**: FFT analysis + oscillator bank resynthesis
- CPU intensive, complex implementation

---

### 🥁 9. DRUM PATTERNS (6 programs)
**Not an effect** - Drum machine/sequencer

---

### 🎹 10. SYNTH SOUNDS (10 programs)
**Not an effect** - Synthesizer oscillators

---

### 🎚️ 11. EQ (2 programs)
**Web Audio: TRIVIAL**

**Implementation:** Multiple BiquadFilterNode (peaking, shelf)

---

## Standalone Effects Suitable for Web Audio Extension

### High Priority (Unique & Feasible)
1. **Vowel Filter** - Vocal formant filtering
2. **Radio Filter** - AM radio tuning effect
3. **Center Canceler** - Vocal removal (mid-side)
4. **Vinyl Break** - Vinyl stop/slowdown
5. **Yoi Yoi** - DJ rewind effect
6. **Slicer** - Rhythmic gate/tremolo
7. **Dub Echo** - Filtered feedback delay
8. **Tape Echo** - Modulated delay
9. **Ping Pong Delay** - Stereo delay
10. **3 Band Delay** - Multi-band delay
11. **Random LFO Filter** - Glitchy filter sweeps
12. **Step Phaser** - Quantized phaser
13. **Talk Filter** - Formant modulation
14. **Jag Filter** - Stepped filter sweep

### Medium Priority (Moderate Complexity)
1. **Gate Reverb** - Gated reverb tail
2. **Ducking Compressor** - Sidechain compression
3. **Reverse Delay** - Backward echoes
4. **LoFi Echo** - Degraded delay
5. **Broken Modulation** - Glitchy modulation
6. **Decimator** - Sample rate reduction (already have!)

### Low Priority (Complex/CPU Intensive)
1. **Grain Shifter** - Granular synthesis
2. **Vocoder** - FFT-based resynthesis
3. **Looper** - Not a typical effect
4. **Sampler** - Not a typical effect

---

## X/Y Pad Control Paradigm

The Kaoss Pad uses a 2D touchpad where:
- **X-axis**: Typically controls one effect parameter
- **Y-axis**: Typically controls another parameter
- **Touch pressure** (some models): Third parameter

For web extension:
- Could map X/Y to two sliders
- Or use mouse position on a 2D pad
- Example: X = filter frequency, Y = resonance

---

## Effects We DON'T Have Yet (High Value)

### New Filters
- **Vowel Filter** - Formant filter with a/e/i/o/u morphing
- **Radio Filter** - Bandpass sweep simulating AM radio
- **Center Canceler** - Mid/side processing for vocal removal
- **Isolator** - DJ-style 3-band kill EQ

### New Modulation
- **Vinyl Break** - Vinyl stop effect
- **Yoi Yoi** - DJ rewind/fast reverse
- **Talk Filter** - Vocal formant modulation
- **Broken Modulation** - Glitchy/random modulation

### New Delay Types
- **Dub Echo** - Filtered feedback delay
- **Ping Pong Delay** - Stereo bouncing
- **3 Band Delay** - Different delay per frequency band
- **Reverse Delay** - Backwards echoes
- **LoFi Echo** - Bitcrushed delay

### New Rhythmic Effects
- **Slicer** - Rhythmic gate (tremolo gate)
- **Step Phaser** - Quantized phaser sweep
- **Jag Filter** - Stepped filter sweep

### Other
- **Gate Reverb** - Hard-cut reverb tail
- **Ducking Compressor** - Sidechain-style

---

## Implementation Priority for Our Extension

### Quick Wins (Easy + Unique)
1. **Slicer** - Square wave LFO → Gain (gate effect)
2. **Ping Pong Delay** - Stereo delay taps
3. **Dub Echo** - Delay + LPF in feedback
4. **Vowel Filter** - Multi-bandpass at formant frequencies
5. **Radio Filter** - Narrow bandpass with LFO sweep

### Medium Effort (Great Results)
1. **Vinyl Break** - Variable playback rate + filtering
2. **3 Band Delay** - Split into bands, delay separately
3. **Reverse Delay** - Buffer reverse + delay
4. **Gate Reverb** - Reverb + hard envelope cutoff
5. **Center Canceler** - Mid/side processing

### Advanced (High Complexity)
1. **Granular Effects** - Grain shifter/freeze
2. **Vocoder** - FFT analysis + resynthesis

---

## References
- Korg Kaoss Pad KP3 Official Page: https://www.korg.com/us/products/dj/kaoss_pad_kp3_plus/
- KP3 Program List: https://www.korg.com/us/support/download/manual/1/118/1746/
- Sound on Sound KP3 Review: https://www.soundonsound.com/reviews/korg-kaoss-pad-3
