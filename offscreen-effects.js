// Multi-effect offscreen document for Browser FX

console.log("🎵 Multi-effect offscreen document loaded - TESTING IF THIS APPEARS!")
console.log("🎵 OFFSCREEN DOCUMENT IS WORKING AND LOADED!")
window.postMessage({ type: 'OFFSCREEN_LOADED' }, '*')

let audioContext = null

// Per-tab audio processing state
const tabAudioState = new Map()

// Default effect state for new tabs
const defaultEffectId = "bitcrusher"
const defaultEffectParams = {}

// Live parameter variables for real-time updates
let liveParams = {
  // Bitcrusher
  bits: 4,
  normalRange: 0.4,
  wet: 1.0,
  // Reverb
  roomSize: 0.7,
  decay: 2.0,
  // Distortion
  amount: 0.5,
  tone: 0.5,
  // Chorus
  rate: 2.0,
  depth: 0.6,
  delay: 0.025,
  // Phaser
  stages: 4,
}

// Initialize Web Audio context
function initializeAudioContext() {
  if (!audioContext) {
    audioContext = new AudioContext()
    console.log("AudioContext initialized, sample rate:", audioContext.sampleRate)
  }
  return audioContext
}

/**
 * Smoothly transition an AudioParam to a new value to avoid clicks/pops
 * @param {AudioParam} param - The parameter to change
 * @param {number} targetValue - The target value
 * @param {number} rampTime - Ramp duration in seconds (default: 0.02)
 * @param {string} type - 'linear' or 'exponential' (default: 'exponential')
 */
function smoothParamChange(param, targetValue, rampTime = 0.02, type = 'exponential') {
  if (!param || !audioContext) return

  // A non-finite target would throw inside the message handler and take the
  // whole update down with it; refuse it loudly instead
  if (!Number.isFinite(targetValue)) {
    console.warn('🎵 Ignoring non-finite param target:', targetValue)
    return
  }

  const now = audioContext.currentTime

  // Cancel any scheduled changes
  param.cancelScheduledValues(now)

  // Set current value as starting point
  param.setValueAtTime(param.value, now)

  // Ramp to new value. Exponential ramps need both endpoints comfortably
  // above zero; otherwise fall back to linear (also handles negative values).
  if (type === 'exponential' && targetValue > 0.0001 && param.value > 0.0001) {
    // Exponential ramp (more natural sounding, can't reach zero)
    param.exponentialRampToValueAtTime(targetValue, now + rampTime)
  } else {
    // Linear ramp (for zero/negative values or when specified)
    param.linearRampToValueAtTime(targetValue, now + rampTime)
  }
}

// Chorus LFO depth in seconds: a gentle absolute swing (max ~2ms) that stays
// clear of the 0ms delay clamp. Proportional scaling at short delays produced
// deep pitch wobble; fixed-ms modulation is what keeps chorus lush.
function chorusModDepth(delayMs, depth) {
  return Math.min(depth * 0.002, (delayMs / 1000) * 0.8)
}

// Get or create tab audio state
function getTabState(tabId) {
  if (!tabAudioState.has(tabId)) {
    tabAudioState.set(tabId, {
      sourceNode: null,
      destinationNode: null,
      audioElement: null,
      currentStream: null,
      // Ordered effect slots: [{ effectId, effect, liveParams, params, paramSpecs }]
      chain: []
    })
  }
  return tabAudioState.get(tabId)
}

// Clean up tab audio state
function cleanupTabState(tabId) {
  const state = tabAudioState.get(tabId)
  if (!state) return

  if (state._rebuildTimer) {
    clearTimeout(state._rebuildTimer)
    state._rebuildTimer = null
  }
  if (state.sourceNode) {
    state.sourceNode.disconnect()
  }
  if (state.chain) {
    for (const slot of state.chain) {
      try {
        (slot.outGain || effectOutput(slot.effect)).disconnect()
      } catch (error) {
        console.warn("Error disconnecting effect:", error)
      }
    }
  }
  if (state.destinationNode) {
    state.destinationNode.disconnect()
  }
  if (state.streamDestination) {
    state.streamDestination.disconnect()
  }
  if (state.audioElement) {
    state.audioElement.pause()
    state.audioElement.srcObject = null
  }
  if (state.currentStream) {
    state.currentStream.getTracks().forEach(track => track.stop())
  }

  tabAudioState.delete(tabId)
  console.log(`🎵 Cleaned up tab state for tab ${tabId}`)
}

// Bitcrusher Effect Implementation
function createBitcrusher(context, params, tabLiveParams) {
  const processor = context.createScriptProcessor(4096, 2, 2)
  let lastSampleL = 0
  let lastSampleR = 0
  let sampleCounter = 0

  // Initialize tab-specific live params
  tabLiveParams.bits = params.bits !== undefined ? params.bits : 8
  tabLiveParams.normalRange = params.normalRange !== undefined ? params.normalRange : 0.4
  tabLiveParams.wet = params.wet !== undefined ? params.wet : 1.0

  processor.onaudioprocess = function(e) {
    const inL = e.inputBuffer.getChannelData(0)
    const inR = e.inputBuffer.numberOfChannels > 1 ? e.inputBuffer.getChannelData(1) : inL
    const outL = e.outputBuffer.getChannelData(0)
    const outR = e.outputBuffer.getChannelData(1)

    // Use tab-specific parameters that can be updated in real-time
    const step = Math.pow(2, tabLiveParams.bits - 1)
    const sampleRateReduction = Math.floor(tabLiveParams.normalRange * 32) + 1
    const wet = tabLiveParams.wet

    for (let i = 0; i < inL.length; i++) {
      // Apply sample rate reduction (shared counter keeps channels in sync)
      if (sampleCounter % sampleRateReduction === 0) {
        lastSampleL = inL[i]
        lastSampleR = inR[i]
      }
      sampleCounter++

      // Apply bitcrushing
      const crushedL = Math.round(lastSampleL * step) / step
      const crushedR = Math.round(lastSampleR * step) / step

      // Wet/dry mix using tab-specific parameter
      outL[i] = inL[i] * (1 - wet) + crushedL * wet
      outR[i] = inR[i] * (1 - wet) + crushedR * wet
    }
  }

  return processor
}

// Simple Reverb Effect Implementation
function createReverb(context, params, tabLiveParams) {
  // Per-tab params; shadows the legacy global so every read and write
  // in this function is tab-scoped
  const liveParams = tabLiveParams
  // Initialize live params
  liveParams.roomSize = params.roomSize !== undefined ? params.roomSize : 0.7
  liveParams.decay = params.decay !== undefined ? params.decay : 2.0
  liveParams.wet = params.wet !== undefined ? params.wet : 0.3

  // Create convolver for reverb
  const convolver = context.createConvolver()
  const wetGain = context.createGain()
  const dryGain = context.createGain()
  const outputGain = context.createGain()

  // Create impulse response for reverb
  const length = context.sampleRate * liveParams.decay
  const impulse = context.createBuffer(2, length, context.sampleRate)

  // Bigger rooms decay more slowly: map roomSize 0..1 to a decay exponent
  // of 1.5 (tight) down to 0.5 (spacious)
  const decayExponent = Math.max(1.5 - liveParams.roomSize, 0.3)

  for (let channel = 0; channel < 2; channel++) {
    const channelData = impulse.getChannelData(channel)
    for (let i = 0; i < length; i++) {
      const n = length - i
      channelData[i] = (Math.random() * 2 - 1) * Math.pow(n / length, decayExponent)
    }
  }

  convolver.buffer = impulse

  // Set up initial wet/dry mix
  wetGain.gain.value = liveParams.wet
  dryGain.gain.value = 1 - liveParams.wet

  // Create effect wrapper
  const effectNode = context.createGain()

  // Connect the reverb chain
  effectNode.connect(convolver)
  effectNode.connect(dryGain)
  convolver.connect(wetGain)

  wetGain.connect(outputGain)
  dryGain.connect(outputGain)

  // Store references for cleanup and real-time updates
  effectNode._wetGain = wetGain
  effectNode._dryGain = dryGain
  effectNode._convolver = convolver
  effectNode._outputGain = outputGain

  return { input: effectNode, output: outputGain }
}

// Simple Distortion Effect Implementation
function createDistortion(context, params, tabLiveParams) {
  // Per-tab params; shadows the legacy global so every read and write
  // in this function is tab-scoped
  const liveParams = tabLiveParams
  // Initialize live params
  liveParams.amount = params.amount !== undefined ? params.amount : 0.5
  liveParams.tone = params.tone !== undefined ? params.tone : 0.5
  liveParams.wet = params.wet !== undefined ? params.wet : 0.8

  // Create waveshaper for distortion
  const waveshaper = context.createWaveShaper()
  const filter = context.createBiquadFilter()
  const wetGain = context.createGain()
  const dryGain = context.createGain()
  const inputGain = context.createGain()
  const outputGain = context.createGain()

  // Continuous drive curve: normalized tanh morphs smoothly from gentle
  // warmth to near-hard clipping with no jumps while dragging the knob,
  // and the normalization keeps output level consistent across the range
  function updateDistortionCurve() {
    const samples = 8192
    const curve = new Float32Array(samples)
    const drive = 1 + liveParams.amount * 50  // 1 to 51 drive
    const norm = Math.tanh(drive)

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1
      curve[i] = Math.tanh(x * drive) / norm
    }
    waveshaper.curve = curve
  }

  updateDistortionCurve()
  waveshaper.oversample = '4x'

  // Set up tone filter
  filter.type = 'lowpass'
  filter.frequency.value = 2000 + (liveParams.tone * 8000) // 2kHz to 10kHz range
  filter.Q.value = 1

  // Set up initial wet/dry mix
  wetGain.gain.value = liveParams.wet
  dryGain.gain.value = 1 - liveParams.wet

  // Connect distortion chain
  inputGain.connect(waveshaper)
  inputGain.connect(dryGain)
  waveshaper.connect(filter)
  filter.connect(wetGain)

  wetGain.connect(outputGain)
  dryGain.connect(outputGain)

  // Store references for real-time updates
  inputGain._waveshaper = waveshaper
  inputGain._filter = filter
  inputGain._wetGain = wetGain
  inputGain._dryGain = dryGain
  inputGain._updateDistortionCurve = updateDistortionCurve

  return { input: inputGain, output: outputGain }
}

// Chorus Effect Implementation - Based on Tone.js specs
function createChorus(context, params, tabLiveParams) {
  // Per-tab params; shadows the legacy global so every read and write
  // in this function is tab-scoped
  const liveParams = tabLiveParams
  console.log('🎵 CHORUS: Creating Tone.js-style chorus effect')

  // Initialize live params
  liveParams.rate = params.rate !== undefined ? params.rate : 1.0
  liveParams.depth = params.depth !== undefined ? params.depth : 0.35
  liveParams.delay = params.delay !== undefined ? params.delay : 14  // milliseconds
  liveParams.wet = params.wet !== undefined ? params.wet : 0.5

  // Two modulated voices panned apart, dry anchored in the center. Voice
  // delays sit in doubling territory (14ms and 21ms by default) instead of
  // the sub-10ms comb-filter range that reads as flanging.
  const delay1 = context.createDelay(0.1)
  const delay2 = context.createDelay(0.1)
  const panner1 = context.createStereoPanner()
  const panner2 = context.createStereoPanner()
  const lfo1 = context.createOscillator()
  const lfo2 = context.createOscillator()
  const lfoGain1 = context.createGain()
  const lfoGain2 = context.createGain()
  const wetGain = context.createGain()
  const dryGain = context.createGain()
  const inputGain = context.createGain()
  const outputGain = context.createGain()

  delay1.delayTime.value = liveParams.delay / 1000
  delay2.delayTime.value = (liveParams.delay * 1.5) / 1000

  // Detuned LFO rates keep the two voices from ever phase-locking
  lfo1.frequency.value = liveParams.rate
  lfo2.frequency.value = liveParams.rate * 1.23
  lfo1.type = 'sine'
  lfo2.type = 'sine'

  lfoGain1.gain.value = chorusModDepth(liveParams.delay, liveParams.depth)
  lfoGain2.gain.value = chorusModDepth(liveParams.delay * 1.5, liveParams.depth) * 0.8

  // Ensemble width: voice one left, voice two right
  panner1.pan.value = -0.6
  panner2.pan.value = 0.6

  // Set up wet/dry mix based on parameters
  wetGain.gain.value = liveParams.wet
  dryGain.gain.value = 1 - liveParams.wet

  // Connect LFOs to delay modulation
  lfo1.connect(lfoGain1)
  lfo2.connect(lfoGain2)
  lfoGain1.connect(delay1.delayTime)
  lfoGain2.connect(delay2.delayTime)

  // Connect audio chain
  inputGain.connect(delay1)
  inputGain.connect(delay2)
  inputGain.connect(dryGain)
  delay1.connect(panner1)
  delay2.connect(panner2)
  panner1.connect(wetGain)
  panner2.connect(wetGain)

  wetGain.connect(outputGain)
  dryGain.connect(outputGain)

  // Start LFOs
  lfo1.start()
  lfo2.start()

  console.log('🎵 CHORUS: Effect created with parameters:', {
    rate: liveParams.rate,
    depth: liveParams.depth,
    delay: liveParams.delay,
    wet: liveParams.wet
  })

  // Store references for cleanup and real-time updates
  inputGain._delay1 = delay1
  inputGain._delay2 = delay2
  inputGain._lfo1 = lfo1
  inputGain._lfo2 = lfo2
  inputGain._lfoGain1 = lfoGain1
  inputGain._lfoGain2 = lfoGain2
  inputGain._wetGain = wetGain
  inputGain._dryGain = dryGain

  return { input: inputGain, output: outputGain }
}

// Phaser Effect Implementation - Classic 4-Stage Design
function createPhaser(context, params, tabLiveParams) {
  // Per-tab params; shadows the legacy global so every read and write
  // in this function is tab-scoped
  const liveParams = tabLiveParams
  console.log('🎵 PHASER: Creating classic 4-stage phaser')

  // Initialize live params with classic phaser values
  liveParams.rate = params.rate !== undefined ? params.rate : 1.0      // 1Hz default - musical sweet spot
  liveParams.depth = params.depth !== undefined ? params.depth : 0.7   // 0-1 depth, simpler than octaves
  liveParams.feedback = params.feedback !== undefined ? params.feedback : 0.3  // Feedback for richer phasing
  liveParams.wet = params.wet !== undefined ? params.wet : 0.5         // 50/50 mix for classic phaser

  // Create 4 allpass filters (classic phaser design)
  const allpassFilters = []
  const feedbackGain = context.createGain()
  const lfo = context.createOscillator()
  const lfoGain = context.createGain()
  const wetGain = context.createGain()
  const dryGain = context.createGain()
  const inputGain = context.createGain()
  const outputGain = context.createGain()

  // Create 4 allpass filters with musical frequency spacing
  const baseFreqs = [500, 1000, 1500, 2000]  // Musical intervals
  for (let i = 0; i < 4; i++) {
    const filter = context.createBiquadFilter()
    filter.type = 'allpass'
    filter.frequency.value = baseFreqs[i]
    filter.Q.value = 1  // Standard Q for allpass
    allpassFilters.push(filter)
  }

  // Set up LFO with reasonable modulation range
  lfo.frequency.value = liveParams.rate
  lfo.type = 'sine'
  lfoGain.gain.value = liveParams.depth * 500  // +/- 500Hz modulation max

  // Set up feedback
  feedbackGain.gain.value = liveParams.feedback

  // Set up wet/dry mix
  wetGain.gain.value = liveParams.wet
  dryGain.gain.value = 1 - liveParams.wet

  // Connect LFO to all filters
  lfo.connect(lfoGain)
  allpassFilters.forEach(filter => {
    lfoGain.connect(filter.frequency)
  })

  // Chain filters with feedback
  let currentNode = inputGain
  allpassFilters.forEach(filter => {
    currentNode.connect(filter)
    currentNode = filter
  })

  // Add feedback loop (last filter back to first)
  allpassFilters[3].connect(feedbackGain)
  feedbackGain.connect(allpassFilters[0])

  // Connect wet and dry paths
  allpassFilters[3].connect(wetGain)  // Wet from last filter
  inputGain.connect(dryGain)          // Dry from input

  // Mix outputs
  wetGain.connect(outputGain)
  dryGain.connect(outputGain)

  // Start LFO
  lfo.start()

  console.log('🎵 PHASER: Effect created with parameters:', {
    rate: liveParams.rate + 'Hz',
    depth: liveParams.depth,
    feedback: liveParams.feedback,
    wet: liveParams.wet
  })

  // Store references for real-time updates
  inputGain._filters = allpassFilters
  inputGain._lfo = lfo
  inputGain._lfoGain = lfoGain
  inputGain._feedbackGain = feedbackGain
  inputGain._wetGain = wetGain
  inputGain._dryGain = dryGain

  return { input: inputGain, output: outputGain }
}

// Tremolo Effect Implementation (stereo, with L/R phase spread)
function createTremolo(context, params, tabLiveParams) {
  // Per-tab params; shadows the legacy global so every read and write
  // in this function is tab-scoped
  const liveParams = tabLiveParams
  console.log('🎵 TREMOLO: Creating tremolo effect')

  // Initialize live params
  liveParams.rate = params.rate !== undefined ? params.rate : 6.0
  liveParams.depth = params.depth !== undefined ? params.depth : 0.7
  liveParams.spread = params.spread !== undefined ? params.spread : 40  // degrees of L/R phase offset
  liveParams.wet = params.wet !== undefined ? params.wet : 0.8

  const lfo = context.createOscillator()
  const lfoGain = context.createGain()
  // Delaying the LFO control signal phase-shifts the right channel's tremolo
  const spreadDelay = context.createDelay(10)
  const stereoIn = context.createGain()
  const splitter = context.createChannelSplitter(2)
  const merger = context.createChannelMerger(2)
  const ampL = context.createGain()
  const ampR = context.createGain()
  const wetGain = context.createGain()
  const dryGain = context.createGain()
  const inputGain = context.createGain()
  const outputGain = context.createGain()

  // Force stereo so mono sources still feed both channels
  stereoIn.channelCount = 2
  stereoIn.channelCountMode = 'explicit'

  // Set up LFO
  lfo.frequency.value = liveParams.rate
  lfo.type = 'sine'
  lfoGain.gain.value = liveParams.depth * 0.5  // Scale depth
  ampL.gain.value = 1 - liveParams.depth * 0.5  // DC offset
  ampR.gain.value = 1 - liveParams.depth * 0.5

  // Phase offset in seconds = (spread degrees / 360) / rate
  spreadDelay.delayTime.value = (liveParams.spread / 360) / liveParams.rate

  // Set up wet/dry mix
  wetGain.gain.value = liveParams.wet
  dryGain.gain.value = 1 - liveParams.wet

  // LFO modulates left directly, right through the phase-offset delay
  lfo.connect(lfoGain)
  lfoGain.connect(ampL.gain)
  lfoGain.connect(spreadDelay)
  spreadDelay.connect(ampR.gain)

  // Split, modulate each channel, and merge back
  inputGain.connect(stereoIn)
  stereoIn.connect(splitter)
  splitter.connect(ampL, 0)
  splitter.connect(ampR, 1)
  ampL.connect(merger, 0, 0)
  ampR.connect(merger, 0, 1)

  merger.connect(wetGain)
  inputGain.connect(dryGain)

  wetGain.connect(outputGain)
  dryGain.connect(outputGain)

  // Start LFO
  lfo.start()

  // Store references
  inputGain._lfo = lfo
  inputGain._lfoGain = lfoGain
  inputGain._ampL = ampL
  inputGain._ampR = ampR
  inputGain._spreadDelay = spreadDelay
  inputGain._wetGain = wetGain
  inputGain._dryGain = dryGain

  return { input: inputGain, output: outputGain }
}

// Simple Delay Effect Implementation
function createDelay(context, params, tabLiveParams) {
  // Per-tab params; shadows the legacy global so every read and write
  // in this function is tab-scoped
  const liveParams = tabLiveParams
  console.log('🎵 DELAY: Creating delay effect')

  // Initialize live params
  liveParams.delayTime = params.delayTime !== undefined ? params.delayTime : 0.25
  liveParams.feedback = params.feedback !== undefined ? params.feedback : 0.3
  liveParams.wet = params.wet !== undefined ? params.wet : 0.4

  const delayNode = context.createDelay(2)  // Max 2 seconds
  const feedbackGain = context.createGain()
  const wetGain = context.createGain()
  const dryGain = context.createGain()
  const inputGain = context.createGain()
  const outputGain = context.createGain()

  // Set up delay time
  delayNode.delayTime.value = liveParams.delayTime

  // Set up feedback
  feedbackGain.gain.value = liveParams.feedback

  // Set up wet/dry mix
  wetGain.gain.value = liveParams.wet
  dryGain.gain.value = 1 - liveParams.wet

  // Connect delay chain
  // Input -> delay -> feedback loop
  inputGain.connect(delayNode)
  delayNode.connect(feedbackGain)
  feedbackGain.connect(delayNode)  // Feedback loop

  // Wet/dry mix
  delayNode.connect(wetGain)
  inputGain.connect(dryGain)

  wetGain.connect(outputGain)
  dryGain.connect(outputGain)

  // Store references for live parameter updates
  inputGain._delayNode = delayNode
  inputGain._feedbackGain = feedbackGain
  inputGain._wetGain = wetGain
  inputGain._dryGain = dryGain

  console.log(`🎵 DELAY: Created with ${Math.round(liveParams.delayTime * 1000)}ms delay, ${Math.round(liveParams.feedback * 100)}% feedback`)

  return { input: inputGain, output: outputGain }
}

// Vibrato Effect Implementation
function createVibrato(context, params, tabLiveParams) {
  // Per-tab params; shadows the legacy global so every read and write
  // in this function is tab-scoped
  const liveParams = tabLiveParams
  console.log('🎵 VIBRATO: Creating vibrato effect')

  // Initialize live params
  liveParams.rate = params.rate !== undefined ? params.rate : 5.0
  liveParams.depth = params.depth !== undefined ? params.depth : 0.3
  liveParams.type = params.type !== undefined ? params.type : 0
  liveParams.wet = params.wet !== undefined ? params.wet : 1.0

  const delay = context.createDelay(0.1)
  const lfo = context.createOscillator()
  const lfoGain = context.createGain()
  const wetGain = context.createGain()
  const dryGain = context.createGain()
  const inputGain = context.createGain()
  const outputGain = context.createGain()

  // Set up base delay time (small for vibrato)
  delay.delayTime.value = 0.01  // 10ms base delay

  // Set up LFO for vibrato
  const vibratoWaveforms = ['sine', 'square', 'sawtooth', 'triangle']
  lfo.frequency.value = liveParams.rate
  lfo.type = vibratoWaveforms[Math.floor(liveParams.type) % vibratoWaveforms.length]
  lfoGain.gain.value = liveParams.depth * 0.01  // Convert to seconds

  // Set up wet/dry mix
  wetGain.gain.value = liveParams.wet
  dryGain.gain.value = 1 - liveParams.wet

  // Connect LFO to delay time modulation
  lfo.connect(lfoGain)
  lfoGain.connect(delay.delayTime)

  // Connect audio chain
  inputGain.connect(delay)
  inputGain.connect(dryGain)
  delay.connect(wetGain)

  wetGain.connect(outputGain)
  dryGain.connect(outputGain)

  // Start LFO
  lfo.start()

  // Store references
  inputGain._delay = delay
  inputGain._lfo = lfo
  inputGain._lfoGain = lfoGain
  inputGain._wetGain = wetGain
  inputGain._dryGain = dryGain

  return { input: inputGain, output: outputGain }
}

// Auto Filter Effect Implementation
function createAutoFilter(context, params, tabLiveParams) {
  console.log('🎵 AUTOFILTER: Creating auto filter effect')

  // Initialize live params
  tabLiveParams.rate = params.rate !== undefined ? params.rate : 1.0
  tabLiveParams.depth = params.depth !== undefined ? params.depth : 0.8
  tabLiveParams.baseFreq = params.baseFreq !== undefined ? params.baseFreq : 200
  tabLiveParams.octaves = params.octaves !== undefined ? params.octaves : 3
  tabLiveParams.wet = params.wet !== undefined ? params.wet : 1.0

  const filter = context.createBiquadFilter()
  const lfo = context.createOscillator()
  const lfoGain = context.createGain()
  const wetGain = context.createGain()
  const dryGain = context.createGain()
  const inputGain = context.createGain()
  const outputGain = context.createGain()

  // Set up filter and LFO. The sweep is centered between baseFreq and the
  // octave ceiling so the modulated frequency stays in the intended range
  // instead of clamping at 0Hz for half of each cycle.
  const maxFreq = Math.min(tabLiveParams.baseFreq * Math.pow(2, tabLiveParams.octaves), 15000)
  const sweepHalf = (maxFreq - tabLiveParams.baseFreq) / 2

  filter.type = 'lowpass'
  filter.frequency.value = tabLiveParams.baseFreq + sweepHalf
  filter.Q.value = 2  // Moderate resonance

  lfo.frequency.value = tabLiveParams.rate
  lfo.type = 'sine'
  lfoGain.gain.value = sweepHalf * tabLiveParams.depth

  // Set up wet/dry mix
  wetGain.gain.value = tabLiveParams.wet
  dryGain.gain.value = 1 - tabLiveParams.wet

  // Connect LFO to filter frequency modulation
  lfo.connect(lfoGain)
  lfoGain.connect(filter.frequency)

  // Connect audio chain
  inputGain.connect(filter)
  inputGain.connect(dryGain)
  filter.connect(wetGain)

  wetGain.connect(outputGain)
  dryGain.connect(outputGain)

  // Start LFO
  lfo.start()

  // Store references
  inputGain._filter = filter
  inputGain._lfo = lfo
  inputGain._lfoGain = lfoGain
  inputGain._wetGain = wetGain
  inputGain._dryGain = dryGain

  return { input: inputGain, output: outputGain }
}

// Pitch Shifter Effect Implementation
function createPitchShifter(context, params, tabLiveParams) {
  console.log('🎵 PITCHSHIFTER: Creating pitch shifter effect')

  // Initialize live params
  tabLiveParams.pitch = params.pitch !== undefined ? params.pitch : 0
  tabLiveParams.windowSize = params.windowSize !== undefined ? params.windowSize : 0.05
  tabLiveParams.wet = params.wet !== undefined ? params.wet : 1.0

  // Create a simple pitch shifter using delay and pitch modulation
  const delay1 = context.createDelay(0.5)
  const delay2 = context.createDelay(0.5)
  const lfo = context.createOscillator()
  const lfoGain = context.createGain()
  const wetGain = context.createGain()
  const dryGain = context.createGain()
  const inputGain = context.createGain()
  const outputGain = context.createGain()
  const mixer = context.createGain()

  // Convert semitones to frequency ratio (inverted to fix reversed pitch)
  const pitchRatio = Math.pow(2, -tabLiveParams.pitch / 12)

  // Set up delays for pitch shifting
  const baseDelay = tabLiveParams.windowSize
  delay1.delayTime.value = baseDelay
  delay2.delayTime.value = baseDelay

  // Set up LFO for pitch modulation
  lfo.frequency.value = 1 / (tabLiveParams.windowSize * 2) // Modulation rate based on window
  lfo.type = 'triangle'

  // Modulate delay times to create pitch shifting effect
  lfoGain.gain.value = baseDelay * (1 - 1/pitchRatio) * 0.5

  // Set up wet/dry mix
  wetGain.gain.value = tabLiveParams.wet
  dryGain.gain.value = 1 - tabLiveParams.wet

  // Connect pitch shifter chain
  lfo.connect(lfoGain)
  lfoGain.connect(delay1.delayTime)
  // Inverted modulation for second delay
  const inverter = context.createGain()
  inverter.gain.value = -1
  lfoGain.connect(inverter)
  inverter.connect(delay2.delayTime)

  inputGain.connect(delay1)
  inputGain.connect(delay2)
  inputGain.connect(dryGain)

  delay1.connect(mixer)
  delay2.connect(mixer)
  mixer.gain.value = 0.5 // Mix the two delayed signals
  mixer.connect(wetGain)

  wetGain.connect(outputGain)
  dryGain.connect(outputGain)

  // Start LFO
  lfo.start()

  // Store references
  inputGain._delay1 = delay1
  inputGain._delay2 = delay2
  inputGain._lfo = lfo
  inputGain._lfoGain = lfoGain
  inputGain._wetGain = wetGain
  inputGain._dryGain = dryGain

  // Live update for pitch/window changes, so knob drags don't rebuild the effect
  inputGain._applyPitchSettings = function() {
    const ratio = Math.pow(2, -tabLiveParams.pitch / 12)
    const windowDelay = tabLiveParams.windowSize
    smoothParamChange(delay1.delayTime, windowDelay, 0.03, 'linear')
    smoothParamChange(delay2.delayTime, windowDelay, 0.03, 'linear')
    smoothParamChange(lfo.frequency, 1 / (windowDelay * 2), 0.03, 'linear')
    // Modulation amount can be negative for upward shifts, so ramp linearly
    smoothParamChange(lfoGain.gain, windowDelay * (1 - 1 / ratio) * 0.5, 0.03, 'linear')
  }

  return { input: inputGain, output: outputGain }
}

// Auto Panner Effect Implementation
function createAutoPanner(context, params, tabLiveParams) {
  console.log('🎵 AUTOPANNER: Creating auto panner effect')

  // Initialize live params
  tabLiveParams.rate = params.rate !== undefined ? params.rate : 1.0
  tabLiveParams.depth = params.depth !== undefined ? params.depth : 0.8
  tabLiveParams.type = params.type !== undefined ? params.type : 0
  tabLiveParams.wet = params.wet !== undefined ? params.wet : 1.0

  const panner = context.createStereoPanner ? context.createStereoPanner() : context.createPanner()
  const lfo = context.createOscillator()
  const lfoGain = context.createGain()
  const wetGain = context.createGain()
  const dryGain = context.createGain()
  const inputGain = context.createGain()
  const outputGain = context.createGain()

  // Set up LFO for panning
  lfo.frequency.value = tabLiveParams.rate
  const waveforms = ['sine', 'square', 'sawtooth', 'triangle']
  lfo.type = waveforms[Math.floor(tabLiveParams.type) % waveforms.length]

  // Set up LFO depth
  lfoGain.gain.value = tabLiveParams.depth

  // Set up wet/dry mix
  wetGain.gain.value = tabLiveParams.wet
  dryGain.gain.value = 1 - tabLiveParams.wet

  // Connect panning chain
  lfo.connect(lfoGain)

  if (panner.pan) {
    // StereoPanner (newer API)
    lfoGain.connect(panner.pan)
  } else {
    // PannerNode fallback
    panner.panningModel = 'equalpower'
    panner.setPosition(0, 0, -1)
    // Note: PannerNode doesn't work as well for this, but it's a fallback
  }

  inputGain.connect(panner)
  inputGain.connect(dryGain)
  panner.connect(wetGain)

  wetGain.connect(outputGain)
  dryGain.connect(outputGain)

  // Start LFO
  lfo.start()

  // Store references
  inputGain._panner = panner
  inputGain._lfo = lfo
  inputGain._lfoGain = lfoGain
  inputGain._wetGain = wetGain
  inputGain._dryGain = dryGain

  return { input: inputGain, output: outputGain }
}

// Hall Reverb Effect Implementation
function createHallReverb(context, params, tabLiveParams) {
  console.log('🎵 HALLREVERB: Creating hall reverb effect')

  // Initialize live params
  tabLiveParams.roomSize = params.roomSize !== undefined ? params.roomSize : 0.8
  tabLiveParams.decay = params.decay !== undefined ? params.decay : 4.0
  tabLiveParams.preDelay = params.preDelay !== undefined ? params.preDelay : 0.03
  tabLiveParams.damping = params.damping !== undefined ? params.damping : 6000
  tabLiveParams.wet = params.wet !== undefined ? params.wet : 0.4

  // Create convolver for hall reverb
  const convolver = context.createConvolver()
  const preDelayNode = context.createDelay(1)
  const dampingFilter = context.createBiquadFilter()
  const wetGain = context.createGain()
  const dryGain = context.createGain()
  const inputGain = context.createGain()
  const outputGain = context.createGain()

  // Set up pre-delay
  preDelayNode.delayTime.value = tabLiveParams.preDelay

  // Set up damping filter
  dampingFilter.type = 'lowpass'
  dampingFilter.frequency.value = tabLiveParams.damping
  dampingFilter.Q.value = 1

  // Create hall impulse response
  const length = context.sampleRate * tabLiveParams.decay
  const impulse = context.createBuffer(2, length, context.sampleRate)

  // Bigger rooms decay more slowly: map roomSize to a decay exponent
  const hallDecayExponent = Math.max(1.5 - tabLiveParams.roomSize, 0.3)

  for (let channel = 0; channel < 2; channel++) {
    const channelData = impulse.getChannelData(channel)
    for (let i = 0; i < length; i++) {
      const n = length - i
      // Create hall-like reverb with early reflections. Both components are
      // zero-mean noise; a positive-only term here would put DC into the
      // impulse and the convolver would add a low-end thump to everything.
      const earlyReflection = (Math.random() * 2 - 1) * 0.3 * Math.pow(n / length, 0.5)
      const lateReverb = (Math.random() * 2 - 1) * Math.pow(n / length, hallDecayExponent)
      channelData[i] = (earlyReflection + lateReverb * 0.7) * 0.5
    }
  }

  convolver.buffer = impulse

  // Set up wet/dry mix
  wetGain.gain.value = tabLiveParams.wet
  dryGain.gain.value = 1 - tabLiveParams.wet

  // Connect hall reverb chain
  inputGain.connect(preDelayNode)
  inputGain.connect(dryGain)
  preDelayNode.connect(convolver)
  convolver.connect(dampingFilter)
  dampingFilter.connect(wetGain)

  wetGain.connect(outputGain)
  dryGain.connect(outputGain)

  // Store references for cleanup and real-time updates
  inputGain._convolver = convolver
  inputGain._preDelayNode = preDelayNode
  inputGain._dampingFilter = dampingFilter
  inputGain._wetGain = wetGain
  inputGain._dryGain = dryGain

  return { input: inputGain, output: outputGain }
}

// Tap Tempo Delay Effect Implementation
function createTapTempoDelay(context, params, tabLiveParams) {
  console.log('🎵 TAPTEMPO: Creating tap tempo delay effect')

  // Initialize live params (subdivision 0 is a valid value: 1/4 note)
  tabLiveParams.subdivision = params.subdivision !== undefined ? params.subdivision : 1
  tabLiveParams.feedback = params.feedback !== undefined ? params.feedback : 0.4
  tabLiveParams.tapTempo = params.tapTempo !== undefined ? params.tapTempo : 120
  tabLiveParams.wet = params.wet !== undefined ? params.wet : 0.5

  // Subdivision multipliers (in beats)
  const subdivisions = [
    1.0,    // 0: 1/4 note
    0.5,    // 1: 1/8 note
    0.25,   // 2: 1/16 note
    0.75,   // 3: dotted 1/8 (3/4 of 1/4)
    0.333   // 4: triplet 1/8 (1/3 of 1/4)
  ]

  // Calculate delay time from BPM and subdivision
  const subdivisionIndex = Math.floor(tabLiveParams.subdivision)
  const beatLength = 60 / tabLiveParams.tapTempo // seconds per beat at current BPM
  const delayTime = beatLength * subdivisions[subdivisionIndex]

  const delay = context.createDelay(2.0) // Max 2 seconds for very slow tempos
  const feedbackGain = context.createGain()
  const wetGain = context.createGain()
  const dryGain = context.createGain()
  const inputGain = context.createGain()
  const outputGain = context.createGain()

  // Set up delay time
  delay.delayTime.value = delayTime

  // Set up feedback
  feedbackGain.gain.value = tabLiveParams.feedback

  // Set up wet/dry mix
  wetGain.gain.value = tabLiveParams.wet
  dryGain.gain.value = 1 - tabLiveParams.wet

  // Connect tap tempo delay chain
  inputGain.connect(delay)
  inputGain.connect(dryGain)

  delay.connect(feedbackGain)
  feedbackGain.connect(delay) // Feedback loop
  delay.connect(wetGain)

  wetGain.connect(outputGain)
  dryGain.connect(outputGain)

  // Store references for parameter updates
  inputGain._delay = delay
  inputGain._feedbackGain = feedbackGain
  inputGain._wetGain = wetGain
  inputGain._dryGain = dryGain

  console.log(`🎵 TAPTEMPO: Created with ${tabLiveParams.tapTempo} BPM, subdivision ${subdivisionIndex}, delay ${delayTime.toFixed(3)}s`)

  return { input: inputGain, output: outputGain }
}

// CD Skipper Effect Implementation
function createLoopChop(context, params, tabLiveParams) {
  console.log('🎵 CDSKIPPER: Creating cd skipper effect')

  // Initialize live params (loopSize 0 is a valid value: 1/32 beat)
  tabLiveParams.loopSize = params.loopSize !== undefined ? params.loopSize : 2
  tabLiveParams.stutterRate = params.stutterRate !== undefined ? params.stutterRate : 4
  tabLiveParams.tempo = params.tempo !== undefined ? params.tempo : 120
  tabLiveParams.wet = params.wet !== undefined ? params.wet : 0.8

  // Loop size multipliers (in beats at 120 BPM as reference)
  const loopSizes = [
    0.125,  // 0: 1/32 beat
    0.25,   // 1: 1/16 beat
    0.5,    // 2: 1/8 beat
    1.0,    // 3: 1/4 beat
    2.0     // 4: 1/2 beat
  ]

  // Calculate loop time from the tempo knob
  const bpm = tabLiveParams.tempo
  const beatLength = 60 / bpm
  const loopSizeIndex = Math.floor(tabLiveParams.loopSize)
  const loopTime = beatLength * loopSizes[loopSizeIndex]

  // Buffer size for loop (at 44.1kHz)
  const bufferSize = Math.floor(loopTime * context.sampleRate)
  console.log(`🎵 LOOPCHOP: Loop time ${loopTime.toFixed(3)}s, buffer size ${bufferSize} samples`)

  // Create audio processing components (stereo)
  const scriptProcessor = context.createScriptProcessor(4096, 2, 2)
  const wetGain = context.createGain()
  const dryGain = context.createGain()
  const inputGain = context.createGain()
  const outputGain = context.createGain()

  // Audio buffers for storing the loop
  const captureBufferL = new Float32Array(bufferSize)
  const captureBufferR = new Float32Array(bufferSize)
  let playbackBufferL = new Float32Array(bufferSize)
  let playbackBufferR = new Float32Array(bufferSize)
  let captureIndex = 0
  let playbackIndex = 0
  let isCapturing = true
  let captureComplete = false
  let stutterCount = 0
  let maxStutters = Math.floor(tabLiveParams.stutterRate)

  // Set up wet/dry mix
  wetGain.gain.value = tabLiveParams.wet
  dryGain.gain.value = 1 - tabLiveParams.wet

  // Audio processing function
  scriptProcessor.onaudioprocess = function(audioProcessingEvent) {
    const inputBuffer = audioProcessingEvent.inputBuffer
    const outputBuffer = audioProcessingEvent.outputBuffer
    const inL = inputBuffer.getChannelData(0)
    const inR = inputBuffer.numberOfChannels > 1 ? inputBuffer.getChannelData(1) : inL
    const outL = outputBuffer.getChannelData(0)
    const outR = outputBuffer.getChannelData(1)

    for (let i = 0; i < inL.length; i++) {
      if (isCapturing && !captureComplete) {
        // Capture phase: record audio into buffer
        captureBufferL[captureIndex] = inL[i]
        captureBufferR[captureIndex] = inR[i]
        captureIndex++

        if (captureIndex >= bufferSize) {
          // Capture complete, copy to playback buffers and start stuttering
          playbackBufferL = new Float32Array(captureBufferL)
          playbackBufferR = new Float32Array(captureBufferR)
          captureComplete = true
          isCapturing = false
          playbackIndex = 0
          stutterCount = 0
        }

        outL[i] = inL[i] // Pass through during capture
        outR[i] = inR[i]
      } else if (captureComplete) {
        // Stutter phase: play back the captured loop
        outL[i] = playbackBufferL[playbackIndex]
        outR[i] = playbackBufferR[playbackIndex]
        playbackIndex++

        if (playbackIndex >= bufferSize) {
          // Loop completed
          stutterCount++
          playbackIndex = 0

          if (stutterCount >= maxStutters) {
            // Stutter cycle complete, start new capture
            isCapturing = true
            captureComplete = false
            captureIndex = 0
            stutterCount = 0
          }
        }
      } else {
        // Fallback: pass through
        outL[i] = inL[i]
        outR[i] = inR[i]
      }
    }
  }

  // Connect the processing chain
  inputGain.connect(scriptProcessor)
  inputGain.connect(dryGain)
  scriptProcessor.connect(wetGain)

  wetGain.connect(outputGain)
  dryGain.connect(outputGain)

  // Store references
  inputGain._scriptProcessor = scriptProcessor
  inputGain._wetGain = wetGain
  inputGain._dryGain = dryGain

  console.log(`🎵 LOOPCHOP: Created with loop size ${loopSizeIndex}, ${maxStutters} repeats`)

  return { input: inputGain, output: outputGain }
}

// Simple Filter Effect Implementation
function createSimpleFilter(context, params, tabLiveParams) {
  console.log('🎵 SIMPLEFILTER: Creating simple filter effect')

  // Initialize live params
  tabLiveParams.cutoffFreq = params.cutoffFreq !== undefined ? params.cutoffFreq : 2000
  tabLiveParams.resonance = params.resonance !== undefined ? params.resonance : 15
  tabLiveParams.filterType = params.filterType !== undefined ? params.filterType : 0
  tabLiveParams.wet = params.wet !== undefined ? params.wet : 1.0

  // Filter type mapping
  const filterTypes = ['lowpass', 'highpass', 'bandpass']
  const filterTypeIndex = Math.floor(tabLiveParams.filterType)
  const filterTypeName = filterTypes[filterTypeIndex] || 'lowpass'

  // Create filter components
  const filter = context.createBiquadFilter()
  const wetGain = context.createGain()
  const dryGain = context.createGain()
  const inputGain = context.createGain()
  const outputGain = context.createGain()

  // Set up filter
  filter.type = filterTypeName
  filter.frequency.value = tabLiveParams.cutoffFreq
  filter.Q.value = tabLiveParams.resonance  // Q factor for resonance

  // Set up wet/dry mix
  wetGain.gain.value = tabLiveParams.wet
  dryGain.gain.value = 1 - tabLiveParams.wet

  // Connect filter chain
  inputGain.connect(filter)
  inputGain.connect(dryGain)
  filter.connect(wetGain)

  wetGain.connect(outputGain)
  dryGain.connect(outputGain)

  // Store references for parameter updates
  inputGain._filter = filter
  inputGain._wetGain = wetGain
  inputGain._dryGain = dryGain

  console.log(`🎵 SIMPLEFILTER: Created ${filterTypeName} filter at ${tabLiveParams.cutoffFreq}Hz, Q=${tabLiveParams.resonance}`)

  return { input: inputGain, output: outputGain }
}

// Flanger Effect Implementation
function createFlanger(context, params, tabLiveParams) {
  console.log('🎵 FLANGER: Creating flanger effect')

  // Initialize live params
  tabLiveParams.rate = params.rate !== undefined ? params.rate : 0.5
  tabLiveParams.depth = params.depth !== undefined ? params.depth : 50
  tabLiveParams.feedback = params.feedback !== undefined ? params.feedback : 0.3
  tabLiveParams.wet = params.wet !== undefined ? params.wet : 0.5

  // Create flanger components
  const delay = context.createDelay(0.02) // Max 20ms delay for flanging
  const lfo = context.createOscillator()
  const lfoGain = context.createGain()
  const feedbackGain = context.createGain()
  const wetGain = context.createGain()
  const dryGain = context.createGain()
  const inputGain = context.createGain()
  const outputGain = context.createGain()

  // Set up delay (base delay time for flanging)
  const baseDelayTime = 0.005 // 5ms base delay
  delay.delayTime.value = baseDelayTime

  // Set up LFO for flanging modulation
  lfo.frequency.value = tabLiveParams.rate
  lfo.type = 'sine' // Smooth sine wave for classic flanger sound

  // Convert depth percentage to delay modulation amount. Kept just under the
  // 5ms base delay so full depth never drives delayTime into the 0ms clamp.
  const maxDelayModulation = 0.0045
  const depthAmount = (tabLiveParams.depth / 100) * maxDelayModulation
  lfoGain.gain.value = depthAmount

  // Set up feedback for that classic flanger resonance
  feedbackGain.gain.value = tabLiveParams.feedback

  // Set up wet/dry mix
  wetGain.gain.value = tabLiveParams.wet
  dryGain.gain.value = 1 - tabLiveParams.wet

  // Connect flanger chain
  lfo.connect(lfoGain)
  lfoGain.connect(delay.delayTime)

  inputGain.connect(delay)
  inputGain.connect(dryGain)

  // Feedback loop for resonance
  delay.connect(feedbackGain)
  feedbackGain.connect(delay)

  // Output the delayed signal
  delay.connect(wetGain)

  wetGain.connect(outputGain)
  dryGain.connect(outputGain)

  // Start the LFO
  lfo.start()

  // Store references for parameter updates
  inputGain._delay = delay
  inputGain._lfo = lfo
  inputGain._lfoGain = lfoGain
  inputGain._feedbackGain = feedbackGain
  inputGain._wetGain = wetGain
  inputGain._dryGain = dryGain

  console.log(`🎵 FLANGER: Created with rate ${tabLiveParams.rate}Hz, depth ${tabLiveParams.depth}%, feedback ${Math.round(tabLiveParams.feedback * 100)}%`)

  return { input: inputGain, output: outputGain }
}

// DJ EQ Effect Implementation
function createDJEQ(context, params, tabLiveParams) {
  console.log('🎵 DJEQ: Creating DJ EQ effect')

  // Initialize live params
  tabLiveParams.highGain = params.highGain !== undefined ? params.highGain : 0
  tabLiveParams.lowGain = params.lowGain !== undefined ? params.lowGain : 0
  tabLiveParams.midGain = params.midGain !== undefined ? params.midGain : 0
  tabLiveParams.wet = params.wet !== undefined ? params.wet : 1.0

  // Create EQ filters
  const lowShelf = context.createBiquadFilter()
  const midPeaking = context.createBiquadFilter()
  const highShelf = context.createBiquadFilter()
  const wetGain = context.createGain()
  const dryGain = context.createGain()
  const inputGain = context.createGain()
  const outputGain = context.createGain()

  // Set up low shelf (bass control around 100Hz)
  lowShelf.type = 'lowshelf'
  lowShelf.frequency.value = 100
  lowShelf.gain.value = tabLiveParams.lowGain

  // Set up mid peaking (mid control around 1kHz)
  midPeaking.type = 'peaking'
  midPeaking.frequency.value = 1000
  midPeaking.Q.value = 1.0 // Moderate Q for musical sound
  midPeaking.gain.value = tabLiveParams.midGain

  // Set up high shelf (treble control around 10kHz)
  highShelf.type = 'highshelf'
  highShelf.frequency.value = 10000
  highShelf.gain.value = tabLiveParams.highGain

  // Set up wet/dry mix
  wetGain.gain.value = tabLiveParams.wet
  dryGain.gain.value = 1 - tabLiveParams.wet

  // Connect EQ chain: input -> low -> mid -> high -> output
  inputGain.connect(lowShelf)
  lowShelf.connect(midPeaking)
  midPeaking.connect(highShelf)

  // Wet signal through EQ
  highShelf.connect(wetGain)

  // Dry signal bypass
  inputGain.connect(dryGain)

  wetGain.connect(outputGain)
  dryGain.connect(outputGain)

  // Store references for parameter updates
  inputGain._lowShelf = lowShelf
  inputGain._midPeaking = midPeaking
  inputGain._highShelf = highShelf
  inputGain._wetGain = wetGain
  inputGain._dryGain = dryGain

  console.log(`🎵 DJEQ: Created 3-band EQ - Low: ${tabLiveParams.lowGain}dB, Mid: ${tabLiveParams.midGain}dB, High: ${tabLiveParams.highGain}dB`)

  return { input: inputGain, output: outputGain }
}

// Compressor Effect Implementation
function createCompressor(context, params, tabLiveParams) {
  console.log('🎵 COMPRESSOR: Creating compressor effect')

  // Initialize live params (threshold 0dB and attack 0 are valid values)
  tabLiveParams.threshold = params.threshold !== undefined ? params.threshold : -24
  tabLiveParams.ratio = params.ratio !== undefined ? params.ratio : 4
  tabLiveParams.attack = params.attack !== undefined ? params.attack : 0.003
  tabLiveParams.wet = params.wet !== undefined ? params.wet : 1.0

  // Create compressor using Web Audio API's native DynamicsCompressorNode
  const compressor = context.createDynamicsCompressor()
  const wetGain = context.createGain()
  const dryGain = context.createGain()
  const inputGain = context.createGain()
  const outputGain = context.createGain()

  // Set up compressor parameters
  compressor.threshold.value = tabLiveParams.threshold      // When compression starts
  compressor.ratio.value = tabLiveParams.ratio             // Compression ratio
  compressor.attack.value = tabLiveParams.attack           // Attack time
  compressor.release.value = 0.25                          // 250ms release (musical)
  compressor.knee.value = 30                               // 30dB soft knee (smooth)

  // Set up wet/dry mix
  wetGain.gain.value = tabLiveParams.wet
  dryGain.gain.value = 1 - tabLiveParams.wet

  // Connect compressor chain
  inputGain.connect(compressor)
  inputGain.connect(dryGain)
  compressor.connect(wetGain)

  wetGain.connect(outputGain)
  dryGain.connect(outputGain)

  // Store references for parameter updates
  inputGain._compressor = compressor
  inputGain._wetGain = wetGain
  inputGain._dryGain = dryGain

  console.log(`🎵 COMPRESSOR: Created with threshold ${tabLiveParams.threshold}dB, ratio ${tabLiveParams.ratio}:1, attack ${Math.round(tabLiveParams.attack * 1000)}ms`)

  return { input: inputGain, output: outputGain }
}

// Ring Modulator Effect Implementation (TRUE ring modulation)
function createRingModulator(context, params, tabLiveParams) {
  console.log('🎵 RINGMOD: Creating TRUE ring modulator effect')

  // Initialize live params
  tabLiveParams.carrierFreq = params.carrierFreq !== undefined ? params.carrierFreq : 200
  tabLiveParams.mix = params.mix !== undefined ? params.mix : 50
  tabLiveParams.waveform = params.waveform !== undefined ? params.waveform : 0
  tabLiveParams.wet = params.wet !== undefined ? params.wet : 0.7

  // Waveform types
  const waveforms = ['sine', 'square', 'sawtooth', 'triangle']

  // Create true ring modulator using ScriptProcessor (stereo)
  const scriptProcessor = context.createScriptProcessor(4096, 2, 2)
  const wetGain = context.createGain()
  const dryGain = context.createGain()
  const inputGain = context.createGain()
  const outputGain = context.createGain()

  // Set up wet/dry mix
  wetGain.gain.value = tabLiveParams.wet
  dryGain.gain.value = 1 - tabLiveParams.wet

  // Carrier oscillator state
  let carrierPhase = 0
  const sampleRate = context.sampleRate

  // Generate carrier wave sample
  const generateCarrierSample = (phase, waveType) => {
    switch (waveType) {
      case 'sine':
        return Math.sin(phase)
      case 'square':
        return Math.sin(phase) > 0 ? 1 : -1
      case 'sawtooth':
        return (2 * (phase / (2 * Math.PI))) % 2 - 1
      case 'triangle':
        const sawValue = (2 * (phase / (2 * Math.PI))) % 2 - 1
        return sawValue < 0 ? -2 * sawValue - 1 : -2 * sawValue + 1
      default:
        return Math.sin(phase)
    }
  }

  // True ring modulation processing. Carrier frequency, mix, and waveform are
  // read from tabLiveParams each block so knob drags apply without rebuilding
  // the effect (the shared carrier keeps both channels coherent).
  scriptProcessor.onaudioprocess = function(audioProcessingEvent) {
    const inputBuffer = audioProcessingEvent.inputBuffer
    const outputBuffer = audioProcessingEvent.outputBuffer
    const inL = inputBuffer.getChannelData(0)
    const inR = inputBuffer.numberOfChannels > 1 ? inputBuffer.getChannelData(1) : inL
    const outL = outputBuffer.getChannelData(0)
    const outR = outputBuffer.getChannelData(1)

    const phaseIncrement = (2 * Math.PI * tabLiveParams.carrierFreq) / sampleRate
    const mixAmount = tabLiveParams.mix / 100
    const waveformType = waveforms[Math.floor(tabLiveParams.waveform) % waveforms.length] || 'sine'

    for (let i = 0; i < inL.length; i++) {
      // Generate carrier sample
      const carrierSample = generateCarrierSample(carrierPhase, waveformType)

      // TRUE ring modulation: multiply input by carrier, then mix
      outL[i] = inL[i] * (1 - mixAmount) + inL[i] * carrierSample * mixAmount
      outR[i] = inR[i] * (1 - mixAmount) + inR[i] * carrierSample * mixAmount

      // Update carrier phase
      carrierPhase += phaseIncrement
      if (carrierPhase >= 2 * Math.PI) {
        carrierPhase -= 2 * Math.PI
      }
    }
  }

  // Connect the processing chain
  inputGain.connect(scriptProcessor)
  inputGain.connect(dryGain)
  scriptProcessor.connect(wetGain)

  wetGain.connect(outputGain)
  dryGain.connect(outputGain)

  // Store references for parameter updates
  inputGain._scriptProcessor = scriptProcessor
  inputGain._wetGain = wetGain
  inputGain._dryGain = dryGain

  console.log(`🎵 RINGMOD: Created TRUE ring modulator with ${tabLiveParams.carrierFreq}Hz carrier, ${tabLiveParams.mix}% mix`)

  return { input: inputGain, output: outputGain }
}

// Comb Filter Effect Implementation
function createCombFilter(context, params, tabLiveParams) {
  console.log('🎵 COMBFILTER: Creating comb filter effect')

  // Initialize live params
  tabLiveParams.delayTime = params.delayTime !== undefined ? params.delayTime : 0.01
  tabLiveParams.feedback = params.feedback !== undefined ? params.feedback : 0.7
  tabLiveParams.feedforward = params.feedforward !== undefined ? params.feedforward : 0.5
  tabLiveParams.wet = params.wet !== undefined ? params.wet : 0.6

  // Create comb filter components
  const delay = context.createDelay(0.1) // Max 100ms for comb filtering
  const feedbackGain = context.createGain()
  const feedforwardGain = context.createGain()
  const wetGain = context.createGain()
  const dryGain = context.createGain()
  const inputGain = context.createGain()
  const outputGain = context.createGain()
  const combMixer = context.createGain()

  // Set up delay time
  delay.delayTime.value = tabLiveParams.delayTime

  // Set up feedback (creates resonance)
  feedbackGain.gain.value = tabLiveParams.feedback

  // Set up feedforward (direct + delayed mix)
  feedforwardGain.gain.value = tabLiveParams.feedforward

  // Set up wet/dry mix
  wetGain.gain.value = tabLiveParams.wet
  dryGain.gain.value = 1 - tabLiveParams.wet

  // Connect comb filter chain
  // Input splits to delay and direct path
  inputGain.connect(delay)
  inputGain.connect(dryGain)
  inputGain.connect(combMixer) // Direct signal to mixer

  // Feedback loop for resonance
  delay.connect(feedbackGain)
  feedbackGain.connect(delay)

  // Feedforward path (delayed signal to mixer)
  delay.connect(feedforwardGain)
  feedforwardGain.connect(combMixer)

  // Mix the comb-filtered signal
  combMixer.connect(wetGain)

  wetGain.connect(outputGain)
  dryGain.connect(outputGain)

  // Store references for parameter updates
  inputGain._delay = delay
  inputGain._feedbackGain = feedbackGain
  inputGain._feedforwardGain = feedforwardGain
  inputGain._wetGain = wetGain
  inputGain._dryGain = dryGain

  // Calculate fundamental frequency for logging
  const fundamentalFreq = 1 / tabLiveParams.delayTime
  console.log(`🎵 COMBFILTER: Created with ${Math.round(tabLiveParams.delayTime * 1000)}ms delay (${Math.round(fundamentalFreq)}Hz), feedback ${Math.round(tabLiveParams.feedback * 100)}%`)

  return { input: inputGain, output: outputGain }
}

// Tape Stop Effect Implementation
function createTapeStop(context, params, tabLiveParams) {
  console.log('🎵 TAPESTOP: Creating tape stop effect')

  // Initialize live params
  tabLiveParams.stopTime = params.stopTime || 1.0
  tabLiveParams.restartTime = params.restartTime || 0.5
  tabLiveParams.mode = params.mode !== undefined ? params.mode : 2
  tabLiveParams.wet = params.wet !== undefined ? params.wet : 1.0

  const scriptProcessor = context.createScriptProcessor(4096, 2, 2)
  const wetGain = context.createGain()
  const dryGain = context.createGain()
  const inputGain = context.createGain()
  const outputGain = context.createGain()

  // Circular buffer for tape stop (2 seconds at sample rate, stereo)
  const bufferLength = context.sampleRate * 2
  const bufferL = new Float32Array(bufferLength)
  const bufferR = new Float32Array(bufferLength)
  let writeIndex = 0

  // Playback state
  let readPosition = 0.0  // Fractional read position for variable-speed playback
  let playbackRate = 1.0   // Current playback rate (1.0 = normal, 0.0 = stopped)
  let phase = 'stopping'   // 'stopping', 'stopped', 'restarting', 'playing'
  let phaseTimer = 0        // Samples elapsed in current phase
  let phaseDuration = 0     // Total samples for current phase

  // Start in the stopping phase
  function startStop() {
    phase = 'stopping'
    phaseTimer = 0
    phaseDuration = Math.floor(tabLiveParams.stopTime * context.sampleRate)
    playbackRate = 1.0
  }

  function startRestart() {
    phase = 'restarting'
    phaseTimer = 0
    phaseDuration = Math.floor(tabLiveParams.restartTime * context.sampleRate)
    playbackRate = 0.0
  }

  function startPlaying() {
    phase = 'playing'
    phaseTimer = 0
    // In continuous mode (2), hold at normal speed briefly before stopping again
    phaseDuration = Math.floor(0.5 * context.sampleRate) // 0.5s at normal speed
    playbackRate = 1.0
  }

  // Begin the cycle
  startStop()

  // Set up wet/dry mix
  wetGain.gain.value = tabLiveParams.wet
  dryGain.gain.value = 1 - tabLiveParams.wet

  scriptProcessor.onaudioprocess = function(e) {
    const inL = e.inputBuffer.getChannelData(0)
    const inR = e.inputBuffer.numberOfChannels > 1 ? e.inputBuffer.getChannelData(1) : inL
    const outL = e.outputBuffer.getChannelData(0)
    const outR = e.outputBuffer.getChannelData(1)

    // Refresh durations from live params each block
    const stopSamples = Math.floor(tabLiveParams.stopTime * context.sampleRate)
    const restartSamples = Math.floor(tabLiveParams.restartTime * context.sampleRate)
    const mode = Math.floor(tabLiveParams.mode)

    for (let i = 0; i < inL.length; i++) {
      // Always write incoming audio to circular buffer
      bufferL[writeIndex] = inL[i]
      bufferR[writeIndex] = inR[i]
      writeIndex = (writeIndex + 1) % bufferLength

      // Update phase and playback rate
      phaseTimer++

      if (phase === 'stopping') {
        // Exponential slowdown: rate goes from 1.0 to ~0.0
        const progress = Math.min(phaseTimer / stopSamples, 1.0)
        // Use exponential curve for natural vinyl feel
        playbackRate = Math.max(0, 1.0 - Math.pow(progress, 1.5))

        if (progress >= 1.0) {
          playbackRate = 0.0
          if (mode === 0) {
            // Stop only: stay stopped
            phase = 'stopped'
          } else {
            // Mode 1 or 2: restart after stopping
            startRestart()
          }
        }
      } else if (phase === 'restarting') {
        // Exponential speed-up: rate goes from 0.0 to 1.0
        const progress = Math.min(phaseTimer / restartSamples, 1.0)
        playbackRate = Math.pow(progress, 1.5)

        if (progress >= 1.0) {
          playbackRate = 1.0
          if (mode === 2) {
            // Continuous: play briefly then stop again
            startPlaying()
          } else {
            // Mode 1: stop + restart once, then stay playing
            phase = 'playing'
            phaseDuration = Infinity
          }
        }
      } else if (phase === 'playing' && mode === 2) {
        // In continuous mode, after playing period, stop again
        if (phaseTimer >= phaseDuration) {
          startStop()
        }
      }
      // 'stopped' phase: playbackRate stays at 0

      // Read from circular buffer at variable rate
      if (playbackRate > 0.001) {
        // Advance read position by playback rate
        readPosition = (readPosition + playbackRate) % bufferLength

        // Linear interpolation for smooth playback
        const idx = Math.floor(readPosition)
        const frac = readPosition - idx
        const nextIdx = (idx + 1) % bufferLength

        outL[i] = bufferL[idx] * (1 - frac) + bufferL[nextIdx] * frac
        outR[i] = bufferR[idx] * (1 - frac) + bufferR[nextIdx] * frac
      } else {
        // Stopped: silence
        outL[i] = 0
        outR[i] = 0
      }
    }
  }

  // Connect the processing chain
  inputGain.connect(scriptProcessor)
  inputGain.connect(dryGain)
  scriptProcessor.connect(wetGain)

  wetGain.connect(outputGain)
  dryGain.connect(outputGain)

  // Store references for parameter updates
  inputGain._scriptProcessor = scriptProcessor
  inputGain._wetGain = wetGain
  inputGain._dryGain = dryGain

  // Store a restart function so mode changes can reset the cycle
  inputGain._resetCycle = function() {
    startStop()
  }

  console.log(`🎵 TAPESTOP: Created with stopTime=${tabLiveParams.stopTime}s, restartTime=${tabLiveParams.restartTime}s, mode=${tabLiveParams.mode}`)

  return { input: inputGain, output: outputGain }
}

// Sidechain Pump Effect Implementation
// Envelope-following approach: detects kick/low-end energy and ducks the signal
function createSidechainPump(context, params, tabLiveParams) {
  console.log('🎵 SIDECHAINPUMP: Creating sidechain pump effect (envelope follower)')

  // Initialize live params
  tabLiveParams.filterFreq = params.filterFreq || 100
  tabLiveParams.sensitivity = params.sensitivity !== undefined ? params.sensitivity : 0.1
  tabLiveParams.depth = params.depth !== undefined ? params.depth : 0.8
  tabLiveParams.attack = params.attack || 0.005
  tabLiveParams.release = params.release || 0.25
  tabLiveParams.wet = params.wet !== undefined ? params.wet : 1.0

  const scriptProcessor = context.createScriptProcessor(4096, 2, 2)
  const wetGain = context.createGain()
  const dryGain = context.createGain()
  const inputGain = context.createGain()
  const outputGain = context.createGain()

  // Low-pass filter for kick detection (runs inside ScriptProcessor manually)
  // We'll implement a simple 2-pole lowpass in the audio callback
  let filterState1L = 0, filterState2L = 0
  let filterState1R = 0, filterState2R = 0

  // Envelope follower state
  let envelope = 0.0      // Current detected envelope level
  let duckGain = 1.0      // Current gain applied to signal (1.0 = full, 0.0 = silent)

  // Set up wet/dry mix
  wetGain.gain.value = tabLiveParams.wet
  dryGain.gain.value = 1 - tabLiveParams.wet

  scriptProcessor.onaudioprocess = function(e) {
    const inL = e.inputBuffer.getChannelData(0)
    const inR = e.inputBuffer.numberOfChannels > 1 ? e.inputBuffer.getChannelData(1) : inL
    const outL = e.outputBuffer.getChannelData(0)
    const outR = e.outputBuffer.getChannelData(1)

    const sampleRate = context.sampleRate
    const filterFreq = tabLiveParams.filterFreq
    const sensitivity = tabLiveParams.sensitivity
    const depth = tabLiveParams.depth
    const attack = tabLiveParams.attack
    const release = tabLiveParams.release

    // Calculate lowpass filter coefficient (simple 1-pole per stage, 2 stages = 2-pole)
    // fc = filterFreq, coefficient = e^(-2*pi*fc/sr)
    const filterCoeff = Math.exp(-2.0 * Math.PI * filterFreq / sampleRate)

    // Envelope follower time constants (in samples)
    // Attack: how fast envelope rises when kick hits
    const envAttack = Math.exp(-1.0 / (attack * sampleRate))
    // Release: how fast envelope falls after kick
    const envRelease = Math.exp(-1.0 / (release * sampleRate))

    // Gain smoothing to avoid clicks (fast but not instant)
    const gainAttack = Math.exp(-1.0 / (0.001 * sampleRate))  // 1ms duck
    const gainRelease = Math.exp(-1.0 / (release * sampleRate)) // match release

    for (let i = 0; i < inL.length; i++) {
      // Mix input to mono for detection
      const monoIn = (inL[i] + inR[i]) * 0.5

      // 2-pole lowpass filter to isolate kick/bass
      filterState1L = filterState1L * filterCoeff + monoIn * (1 - filterCoeff)
      filterState2L = filterState2L * filterCoeff + filterState1L * (1 - filterCoeff)
      const lowSignal = filterState2L

      // Rectify (absolute value) for envelope detection
      const rectified = Math.abs(lowSignal)

      // Envelope follower: fast attack, slow release
      if (rectified > envelope) {
        envelope = envAttack * envelope + (1 - envAttack) * rectified
      } else {
        envelope = envRelease * envelope + (1 - envRelease) * rectified
      }

      // Calculate target gain based on envelope vs sensitivity threshold
      // When envelope exceeds sensitivity, duck the signal
      let targetGain = 1.0
      if (envelope > sensitivity) {
        // How much over threshold (normalized)
        const overThreshold = Math.min((envelope - sensitivity) / sensitivity, 1.0)
        // Duck proportionally, scaled by depth
        targetGain = 1.0 - (depth * overThreshold)
      }

      // Smooth the gain to avoid clicks
      if (targetGain < duckGain) {
        duckGain = gainAttack * duckGain + (1 - gainAttack) * targetGain
      } else {
        duckGain = gainRelease * duckGain + (1 - gainRelease) * targetGain
      }

      // Apply gain ducking
      outL[i] = inL[i] * duckGain
      outR[i] = inR[i] * duckGain
    }
  }

  // Connect the processing chain
  inputGain.connect(scriptProcessor)
  inputGain.connect(dryGain)
  scriptProcessor.connect(wetGain)

  wetGain.connect(outputGain)
  dryGain.connect(outputGain)

  // Store references for parameter updates
  inputGain._scriptProcessor = scriptProcessor
  inputGain._wetGain = wetGain
  inputGain._dryGain = dryGain

  console.log(`🎵 SIDECHAINPUMP: Created with filterFreq=${tabLiveParams.filterFreq}Hz, sensitivity=${tabLiveParams.sensitivity}, depth=${tabLiveParams.depth}, attack=${tabLiveParams.attack}s, release=${tabLiveParams.release}s`)

  return { input: inputGain, output: outputGain }
}

// Lo-Fi Tape Effect Implementation
function createLofiTape(context, params, tabLiveParams) {
  console.log('🎵 LOFITAPE: Creating lo-fi tape effect')

  // Initialize live params
  tabLiveParams.wowDepth = params.wowDepth !== undefined ? params.wowDepth : 0.3
  tabLiveParams.flutterRate = params.flutterRate || 6.0
  tabLiveParams.saturation = params.saturation !== undefined ? params.saturation : 0.4
  tabLiveParams.toneRolloff = params.toneRolloff || 6000
  tabLiveParams.wet = params.wet !== undefined ? params.wet : 0.8

  const inputGain = context.createGain()
  const outputGain = context.createGain()
  const wetGain = context.createGain()
  const dryGain = context.createGain()

  // === WOW + FLUTTER: Delay line modulated by two LFOs ===
  // Wow = slow pitch drift, Flutter = fast pitch jitter
  const delayNode = context.createDelay(0.1) // max 100ms
  delayNode.delayTime.value = 0.01 // 10ms base delay

  // Wow LFO (slow: ~0.4 Hz)
  const wowLfo = context.createOscillator()
  wowLfo.type = 'sine'
  wowLfo.frequency.value = 0.4
  const wowGain = context.createGain()
  wowGain.gain.value = tabLiveParams.wowDepth * 0.008 // audible tape drift at higher settings

  // Flutter LFO (faster, based on param)
  const flutterLfo = context.createOscillator()
  flutterLfo.type = 'sine'
  flutterLfo.frequency.value = tabLiveParams.flutterRate
  const flutterGain = context.createGain()
  flutterGain.gain.value = 0.0003 // fixed subtle depth, independent of wow

  // Connect LFOs to delay modulation
  wowLfo.connect(wowGain)
  wowGain.connect(delayNode.delayTime)
  flutterLfo.connect(flutterGain)
  flutterGain.connect(delayNode.delayTime)
  wowLfo.start()
  flutterLfo.start()

  // === SATURATION: Soft tanh waveshaper ===
  const waveshaper = context.createWaveShaper()
  const curveLength = 44100
  const curve = new Float32Array(curveLength)
  function updateSaturationCurve() {
    // Blend between identity and normalized tanh so saturation=0 is fully
    // transparent and higher settings keep a consistent output level
    const sat = tabLiveParams.saturation
    const drive = 1 + sat * 4 // 1x to 5x drive
    const norm = Math.tanh(drive)
    for (let i = 0; i < curveLength; i++) {
      const x = (i * 2) / curveLength - 1
      curve[i] = (1 - sat) * x + (sat * Math.tanh(x * drive)) / norm
    }
    waveshaper.curve = curve
  }
  updateSaturationCurve()
  waveshaper.oversample = '2x'

  // === TONE ROLLOFF: Lowpass filter ===
  const toneFilter = context.createBiquadFilter()
  toneFilter.type = 'lowpass'
  toneFilter.frequency.value = tabLiveParams.toneRolloff
  toneFilter.Q.value = 0.7 // gentle rolloff, no resonance

  // === SIGNAL CHAIN ===
  // input -> delay (wow/flutter) -> waveshaper (saturation) -> lowpass (tone) -> wet mix
  inputGain.connect(delayNode)
  delayNode.connect(waveshaper)
  waveshaper.connect(toneFilter)
  toneFilter.connect(wetGain)

  // Dry path
  inputGain.connect(dryGain)

  // Set up wet/dry mix
  wetGain.gain.value = tabLiveParams.wet
  dryGain.gain.value = 1 - tabLiveParams.wet

  wetGain.connect(outputGain)
  dryGain.connect(outputGain)

  // Store references for parameter updates
  inputGain._wetGain = wetGain
  inputGain._dryGain = dryGain
  inputGain._wowLfo = wowLfo
  inputGain._flutterLfo = flutterLfo
  inputGain._wowGain = wowGain
  inputGain._flutterGain = flutterGain
  inputGain._toneFilter = toneFilter
  inputGain._updateSaturationCurve = updateSaturationCurve

  console.log(`🎵 LOFITAPE: Created with wow=${tabLiveParams.wowDepth}, flutter=${tabLiveParams.flutterRate}Hz, sat=${tabLiveParams.saturation}`)

  return { input: inputGain, output: outputGain }
}

// Create effect based on ID and parameters
function createEffect(effectId, params, tabLiveParams) {
  const context = audioContext
  console.log(`🎵 Creating effect: ${effectId}`, params)
  console.log(`🎵 Available effects in switch: bitcrusher, reverb, distortion, chorus, phaser, tremolo, delay, vibrato, autofilter, pitchshifter, taptempodelay, loopchop, simplefilter, flanger, djeq, compressor, ringmodulator, combfilter, autopanner, hallreverb`)

  let result
  switch (effectId) {
    case 'bitcrusher':
      result = createBitcrusher(context, params, tabLiveParams)
      console.log(`🎵 BITCRUSHER created:`, typeof result, result)
      return result

    case 'reverb':
      result = createReverb(context, params, tabLiveParams)
      console.log(`🎵 REVERB created:`, typeof result, result)
      return result

    case 'distortion':
      result = createDistortion(context, params, tabLiveParams)
      console.log(`🎵 DISTORTION created:`, typeof result, result)
      return result

    case 'chorus':
      console.log(`🎵 CREATING CHORUS EFFECT`)
      result = createChorus(context, params, tabLiveParams)
      console.log(`🎵 CHORUS created:`, typeof result, result)
      return result

    case 'phaser':
      console.log(`🎵 CREATING PHASER EFFECT`)
      result = createPhaser(context, params, tabLiveParams)
      console.log(`🎵 PHASER created:`, typeof result, result)
      return result

    case 'tremolo':
      console.log(`🎵 CREATING TREMOLO EFFECT`)
      result = createTremolo(context, params, tabLiveParams)
      console.log(`🎵 TREMOLO created:`, typeof result, result)
      return result

    case 'delay':
      console.log(`🎵 CREATING DELAY EFFECT`)
      result = createDelay(context, params, tabLiveParams)
      console.log(`🎵 DELAY created:`, typeof result, result)
      return result

    case 'vibrato':
      console.log(`🎵 CREATING VIBRATO EFFECT`)
      result = createVibrato(context, params, tabLiveParams)
      console.log(`🎵 VIBRATO created:`, typeof result, result)
      return result

    case 'autofilter':
      console.log(`🎵 CREATING AUTOFILTER EFFECT`)
      result = createAutoFilter(context, params, tabLiveParams)
      console.log(`🎵 AUTOFILTER created:`, typeof result, result)
      return result

    case 'pitchshifter':
      console.log(`🎵 CREATING PITCH SHIFTER EFFECT`)
      result = createPitchShifter(context, params, tabLiveParams)
      console.log(`🎵 PITCH SHIFTER created:`, typeof result, result)
      return result

    case 'taptempodelay':
      console.log(`🎵 CREATING TAP TEMPO DELAY EFFECT`)
      result = createTapTempoDelay(context, params, tabLiveParams)
      console.log(`🎵 TAP TEMPO DELAY created:`, typeof result, result)
      return result

    case 'loopchop':
      console.log(`🎵 CREATING LOOP CHOP EFFECT`)
      result = createLoopChop(context, params, tabLiveParams)
      console.log(`🎵 LOOP CHOP created:`, typeof result, result)
      return result

    case 'simplefilter':
      console.log(`🎵 CREATING SIMPLE FILTER EFFECT`)
      result = createSimpleFilter(context, params, tabLiveParams)
      console.log(`🎵 SIMPLE FILTER created:`, typeof result, result)
      return result

    case 'flanger':
      console.log(`🎵 CREATING FLANGER EFFECT`)
      result = createFlanger(context, params, tabLiveParams)
      console.log(`🎵 FLANGER created:`, typeof result, result)
      return result

    case 'djeq':
      console.log(`🎵 CREATING DJ EQ EFFECT`)
      result = createDJEQ(context, params, tabLiveParams)
      console.log(`🎵 DJ EQ created:`, typeof result, result)
      return result

    case 'compressor':
      console.log(`🎵 CREATING COMPRESSOR EFFECT`)
      result = createCompressor(context, params, tabLiveParams)
      console.log(`🎵 COMPRESSOR created:`, typeof result, result)
      return result

    case 'ringmodulator':
      console.log(`🎵 CREATING RING MODULATOR EFFECT`)
      result = createRingModulator(context, params, tabLiveParams)
      console.log(`🎵 RING MODULATOR created:`, typeof result, result)
      return result

    case 'combfilter':
      console.log(`🎵 CREATING COMB FILTER EFFECT`)
      result = createCombFilter(context, params, tabLiveParams)
      console.log(`🎵 COMB FILTER created:`, typeof result, result)
      return result

    case 'autopanner':
      console.log(`🎵 CREATING AUTO PANNER EFFECT`)
      result = createAutoPanner(context, params, tabLiveParams)
      console.log(`🎵 AUTO PANNER created:`, typeof result, result)
      return result

    case 'hallreverb':
      console.log(`🎵 CREATING HALL REVERB EFFECT`)
      result = createHallReverb(context, params, tabLiveParams)
      console.log(`🎵 HALL REVERB created:`, typeof result, result)
      return result

    case 'tapestop':
      console.log(`🎵 CREATING TAPE STOP EFFECT`)
      result = createTapeStop(context, params, tabLiveParams)
      console.log(`🎵 TAPE STOP created:`, typeof result, result)
      return result

    case 'sidechainpump':
      console.log(`🎵 CREATING SIDECHAIN PUMP EFFECT`)
      result = createSidechainPump(context, params, tabLiveParams)
      console.log(`🎵 SIDECHAIN PUMP created:`, typeof result, result)
      return result

    case 'lofitape':
      console.log(`🎵 CREATING LO-FI TAPE EFFECT`)
      result = createLofiTape(context, params, tabLiveParams)
      console.log(`🎵 LO-FI TAPE created:`, typeof result, result)
      return result

    default:
      console.warn(`🎵 Unknown effect: ${effectId} - FALLING BACK TO BITCRUSHER!`)
      result = createBitcrusher(context, params, tabLiveParams)
      console.log(`🎵 DEFAULT (bitcrusher fallback) created:`, typeof result, result)
      return result
  }
}

// Chain node helpers: bitcrusher-style effects are a bare node, the rest
// expose { input, output }
function effectInput(effect) {
  return effect.input || effect
}

function effectOutput(effect) {
  return effect.output || effect
}

// Build (or rebuild) a tab's full effect chain from a spec array of
// { effectId, params, paramSpecs }. Crossfades from the old chain when audio
// is live so structural edits don't click.
function buildChainForTab(chainSpec, tabId) {
  console.log(`\u{1F3B5} Building chain for tab ${tabId}:`, chainSpec.map(s => s.effectId).join(' -> '))

  if (!audioContext) {
    console.error("\u{1F3B5} No audioContext available for chain build")
    return
  }
  if (!Array.isArray(chainSpec) || chainSpec.length === 0) return

  const state = getTabState(tabId)

  // Any explicit rebuild supersedes a pending debounced one
  if (state._rebuildTimer) {
    clearTimeout(state._rebuildTimer)
    state._rebuildTimer = null
  }

  // Create all slots first; on failure keep the current chain running
  let newChain
  try {
    newChain = chainSpec.map((slotSpec) => {
      const liveParams = {}
      const effect = createEffect(slotSpec.effectId, slotSpec.params || {}, liveParams)
      const enabled = slotSpec.enabled !== false

      // Per-slot bypass wrapper: the input feeds both the effect and a dry
      // route, and two gates crossfade between them so toggling never clicks.
      // The effect keeps running while bypassed, preserving its state.
      const inGain = audioContext.createGain()
      const outGain = audioContext.createGain()
      const wetGate = audioContext.createGain()
      const dryGate = audioContext.createGain()
      inGain.connect(effectInput(effect))
      effectOutput(effect).connect(wetGate)
      wetGate.connect(outGain)
      inGain.connect(dryGate)
      dryGate.connect(outGain)
      wetGate.gain.value = enabled ? 1 : 0
      dryGate.gain.value = enabled ? 0 : 1

      return {
        id: slotSpec.id || null,
        effectId: slotSpec.effectId,
        effect,
        liveParams,
        params: { ...(slotSpec.params || {}) },
        paramSpecs: slotSpec.paramSpecs || null,
        enabled,
        inGain,
        outGain,
        wetGate,
        dryGate
      }
    })
  } catch (error) {
    console.error(`\u{1F3B5} Failed to build chain for tab ${tabId}:`, error)
    throw error
  }

  // Wire the slots together through their bypass wrappers
  for (let i = 0; i < newChain.length - 1; i++) {
    newChain[i].outGain.connect(newChain[i + 1].inGain)
  }

  const oldChain = state.chain || []
  const crossfadeTime = 0.05

  if (state.sourceNode && state.destinationNode) {
    if (oldChain.length) {
      try {
        const now = audioContext.currentTime
        const oldGain = audioContext.createGain()
        const newGain = audioContext.createGain()
        oldGain.gain.setValueAtTime(1.0, now)
        oldGain.gain.linearRampToValueAtTime(0.0, now + crossfadeTime)
        newGain.gain.setValueAtTime(0.0, now)
        newGain.gain.linearRampToValueAtTime(1.0, now + crossfadeTime)

        // Route the old chain's tail through the fade-out gain
        const oldTail = oldChain[oldChain.length - 1].outGain || effectOutput(oldChain[oldChain.length - 1].effect)
        oldTail.disconnect()
        oldTail.connect(oldGain)
        oldGain.connect(state.destinationNode)

        // Bring the new chain in through the fade-in gain
        state.sourceNode.connect(newChain[0].inGain)
        newChain[newChain.length - 1].outGain.connect(newGain)
        newGain.connect(state.destinationNode)

        // Tear the old chain down once the fade completes
        const oldHead = oldChain[0].inGain || effectInput(oldChain[0].effect)
        const sourceNode = state.sourceNode
        setTimeout(() => {
          try { sourceNode.disconnect(oldHead) } catch (e) {}
          try { oldGain.disconnect() } catch (e) {}
          for (const slot of oldChain) {
            try { (slot.outGain || effectOutput(slot.effect)).disconnect() } catch (e) {}
          }
        }, crossfadeTime * 1000 + 100)
      } catch (error) {
        console.error(`\u{1F3B5} ERROR during chain crossfade for tab ${tabId}:`, error)
        try {
          state.sourceNode.disconnect()
          state.sourceNode.connect(newChain[0].inGain)
          newChain[newChain.length - 1].outGain.connect(state.destinationNode)
        } catch (e) {}
      }
    } else {
      state.sourceNode.connect(newChain[0].inGain)
      newChain[newChain.length - 1].outGain.connect(state.destinationNode)
    }
  }

  state.chain = newChain
}

// Rebuild-class parameters (impulse responses, buffer sizes) can't update
// live. Debounce the rebuild so a MIDI sweep rebuilds once at rest instead
// of dozens of times per second. Rebuilds the whole chain from its current
// params, which also survives the user switching effects mid-debounce.
function scheduleChainRebuild(tabId) {
  const state = getTabState(tabId)
  if (state._rebuildTimer) clearTimeout(state._rebuildTimer)
  state._rebuildTimer = setTimeout(() => {
    state._rebuildTimer = null
    if (!tabAudioState.has(tabId) || !state.chain || !state.chain.length) return
    buildChainForTab(
      state.chain.map(s => ({ id: s.id, effectId: s.effectId, params: s.params, paramSpecs: s.paramSpecs, enabled: s.enabled })),
      tabId
    )
  }, 150)
}

// Update parameters for specific tab
function updateEffectParamsForTab(effectId, params, tabId, slotIndex = 0) {
  console.log(`🎵 Updating effect params for tab ${tabId}, slot ${slotIndex}, effect ${effectId}:`, params)

  const state = getTabState(tabId)
  const slot = state.chain && state.chain[slotIndex]

  if (!slot) return
  if (effectId !== slot.effectId) {
    console.warn(`🎵 Param update for wrong effect ${effectId} in slot ${slotIndex} on tab ${tabId} (current: ${slot.effectId})`)
    return
  }

  // Drop no-op updates: MIDI sweeps repeat the same quantized value many
  // times per second, and stepped params must not retrigger rebuilds
  const changed = {}
  let hasChange = false
  for (const key of Object.keys(params)) {
    if (slot.params[key] !== params[key]) {
      changed[key] = params[key]
      hasChange = true
    }
  }
  if (!hasChange) return
  params = changed

  // Update live parameters for this tab
  Object.assign(slot.liveParams, params)
  Object.assign(slot.params, params)

  // Apply real-time updates based on effect type
  if (!slot.effect) return

  // Note: For simplicity, I'm only implementing the most commonly changed parameters
  // The bitcrusher parameters will update automatically via the tab's liveParams reference
  switch (slot.effectId) {
    case 'bitcrusher':
      // Bitcrusher parameters are updated automatically via liveParams in the audio callback
      break

    case 'reverb':
      // Update wet/dry mix in real-time with smooth transitions
      if (params.wet !== undefined && slot.effect.input._wetGain && slot.effect.input._dryGain) {
        smoothParamChange(slot.effect.input._wetGain.gain, slot.liveParams.wet, 0.015)
        smoothParamChange(slot.effect.input._dryGain.gain, 1 - slot.liveParams.wet, 0.015)
      }
      // Note: roomSize and decay require effect recreation
      if (params.roomSize !== undefined || params.decay !== undefined) {
        scheduleChainRebuild(tabId)
      }
      break

    case 'taptempodelay':
      // Update wet/dry mix and feedback in real-time with smooth transitions
      if (params.wet !== undefined && slot.effect.input._wetGain && slot.effect.input._dryGain) {
        smoothParamChange(slot.effect.input._wetGain.gain, slot.liveParams.wet, 0.015)
        smoothParamChange(slot.effect.input._dryGain.gain, 1 - slot.liveParams.wet, 0.015)
      }
      if (params.feedback !== undefined && slot.effect.input._feedbackGain) {
        smoothParamChange(slot.effect.input._feedbackGain.gain, slot.liveParams.feedback, 0.015)
      }
      // Note: subdivision or tapTempo changes require effect recreation to recalculate delay time
      if (params.subdivision !== undefined || params.tapTempo !== undefined) {
        scheduleChainRebuild(tabId)
      }
      break

    case 'loopchop':
      // Update wet/dry mix in real-time with smooth transitions
      if (params.wet !== undefined && slot.effect.input._wetGain && slot.effect.input._dryGain) {
        smoothParamChange(slot.effect.input._wetGain.gain, slot.liveParams.wet, 0.015)
        smoothParamChange(slot.effect.input._dryGain.gain, 1 - slot.liveParams.wet, 0.015)
      }
      // Note: loopSize, stutterRate, and tempo changes require effect
      // recreation to resize the capture buffer
      if (params.loopSize !== undefined || params.stutterRate !== undefined || params.tempo !== undefined) {
        scheduleChainRebuild(tabId)
      }
      break

    case 'simplefilter':
      // Update filter parameters in real-time with smooth transitions
      if (params.cutoffFreq !== undefined && slot.effect.input._filter) {
        smoothParamChange(slot.effect.input._filter.frequency, slot.liveParams.cutoffFreq, 0.02)
      }
      if (params.resonance !== undefined && slot.effect.input._filter) {
        smoothParamChange(slot.effect.input._filter.Q, slot.liveParams.resonance, 0.02)
      }
      if (params.wet !== undefined && slot.effect.input._wetGain && slot.effect.input._dryGain) {
        smoothParamChange(slot.effect.input._wetGain.gain, slot.liveParams.wet, 0.015)
        smoothParamChange(slot.effect.input._dryGain.gain, 1 - slot.liveParams.wet, 0.015)
      }
      // Filter type switches live on the BiquadFilter, no rebuild needed
      if (params.filterType !== undefined && slot.effect.input._filter) {
        const liveFilterTypes = ['lowpass', 'highpass', 'bandpass']
        slot.effect.input._filter.type =
          liveFilterTypes[Math.floor(slot.liveParams.filterType)] || 'lowpass'
      }
      break

    case 'flanger':
      // Update flanger parameters in real-time with smooth transitions
      if (params.rate !== undefined && slot.effect.input._lfo) {
        smoothParamChange(slot.effect.input._lfo.frequency, slot.liveParams.rate, 0.02)
      }
      if (params.depth !== undefined && slot.effect.input._lfoGain) {
        // Match creation scaling: stays under the 5ms base delay
        const maxDelayModulation = 0.0045
        const depthAmount = (slot.liveParams.depth / 100) * maxDelayModulation
        smoothParamChange(slot.effect.input._lfoGain.gain, depthAmount, 0.015)
      }
      if (params.feedback !== undefined && slot.effect.input._feedbackGain) {
        smoothParamChange(slot.effect.input._feedbackGain.gain, slot.liveParams.feedback, 0.015)
      }
      if (params.wet !== undefined && slot.effect.input._wetGain && slot.effect.input._dryGain) {
        smoothParamChange(slot.effect.input._wetGain.gain, slot.liveParams.wet, 0.015)
        smoothParamChange(slot.effect.input._dryGain.gain, 1 - slot.liveParams.wet, 0.015)
      }
      break

    case 'djeq':
      // Update EQ bands in real-time with smooth transitions
      if (params.lowGain !== undefined && slot.effect.input._lowShelf) {
        smoothParamChange(slot.effect.input._lowShelf.gain, slot.liveParams.lowGain, 0.02)
      }
      if (params.midGain !== undefined && slot.effect.input._midPeaking) {
        smoothParamChange(slot.effect.input._midPeaking.gain, slot.liveParams.midGain, 0.02)
      }
      if (params.highGain !== undefined && slot.effect.input._highShelf) {
        smoothParamChange(slot.effect.input._highShelf.gain, slot.liveParams.highGain, 0.02)
      }
      if (params.wet !== undefined && slot.effect.input._wetGain && slot.effect.input._dryGain) {
        smoothParamChange(slot.effect.input._wetGain.gain, slot.liveParams.wet, 0.015)
        smoothParamChange(slot.effect.input._dryGain.gain, 1 - slot.liveParams.wet, 0.015)
      }
      break

    case 'compressor':
      // Update compressor parameters in real-time with smooth transitions
      if (params.threshold !== undefined && slot.effect.input._compressor) {
        smoothParamChange(slot.effect.input._compressor.threshold, slot.liveParams.threshold, 0.02)
      }
      if (params.ratio !== undefined && slot.effect.input._compressor) {
        smoothParamChange(slot.effect.input._compressor.ratio, slot.liveParams.ratio, 0.02)
      }
      if (params.attack !== undefined && slot.effect.input._compressor) {
        smoothParamChange(slot.effect.input._compressor.attack, slot.liveParams.attack, 0.02)
      }
      if (params.wet !== undefined && slot.effect.input._wetGain && slot.effect.input._dryGain) {
        smoothParamChange(slot.effect.input._wetGain.gain, slot.liveParams.wet, 0.015)
        smoothParamChange(slot.effect.input._dryGain.gain, 1 - slot.liveParams.wet, 0.015)
      }
      break

    case 'ringmodulator':
      // carrierFreq, mix, and waveform are read live from liveParams in the
      // audio callback; only the wet/dry gains need explicit ramps
      if (params.wet !== undefined && slot.effect.input._wetGain && slot.effect.input._dryGain) {
        smoothParamChange(slot.effect.input._wetGain.gain, slot.liveParams.wet, 0.015)
        smoothParamChange(slot.effect.input._dryGain.gain, 1 - slot.liveParams.wet, 0.015)
      }
      break

    case 'combfilter':
      // Update comb filter parameters in real-time with smooth transitions
      if (params.feedback !== undefined && slot.effect.input._feedbackGain) {
        smoothParamChange(slot.effect.input._feedbackGain.gain, slot.liveParams.feedback, 0.015)
      }
      if (params.feedforward !== undefined && slot.effect.input._feedforwardGain) {
        smoothParamChange(slot.effect.input._feedforwardGain.gain, slot.liveParams.feedforward, 0.015)
      }
      if (params.wet !== undefined && slot.effect.input._wetGain && slot.effect.input._dryGain) {
        smoothParamChange(slot.effect.input._wetGain.gain, slot.liveParams.wet, 0.015)
        smoothParamChange(slot.effect.input._dryGain.gain, 1 - slot.liveParams.wet, 0.015)
      }
      // Note: delayTime changes require effect recreation
      if (params.delayTime !== undefined) {
        scheduleChainRebuild(tabId)
      }
      break

    case 'distortion':
      // Update wet/dry mix and tone filter in real-time with smooth transitions
      if (params.wet !== undefined && slot.effect.input._wetGain && slot.effect.input._dryGain) {
        smoothParamChange(slot.effect.input._wetGain.gain, slot.liveParams.wet, 0.015)
        smoothParamChange(slot.effect.input._dryGain.gain, 1 - slot.liveParams.wet, 0.015)
      }
      if (params.tone !== undefined && slot.effect.input._filter) {
        smoothParamChange(slot.effect.input._filter.frequency, 2000 + (slot.liveParams.tone * 8000), 0.025)
      }
      if (params.amount !== undefined && slot.effect.input._updateDistortionCurve) {
        slot.effect.input._updateDistortionCurve()
      }
      break

    case 'chorus':
      // Update wet/dry mix and LFO parameters in real-time with smooth transitions
      if (params.wet !== undefined && slot.effect.input._wetGain && slot.effect.input._dryGain) {
        smoothParamChange(slot.effect.input._wetGain.gain, slot.liveParams.wet, 0.015)
        smoothParamChange(slot.effect.input._dryGain.gain, 1 - slot.liveParams.wet, 0.015)
      }
      if (params.rate !== undefined && slot.effect.input._lfo1 && slot.effect.input._lfo2) {
        smoothParamChange(slot.effect.input._lfo1.frequency, slot.liveParams.rate, 0.02)
        smoothParamChange(slot.effect.input._lfo2.frequency, slot.liveParams.rate * 1.23, 0.02)
      }
      if (params.depth !== undefined || params.delay !== undefined) {
        const delayMs = slot.liveParams.delay
        if (params.delay !== undefined && slot.effect.input._delay1 && slot.effect.input._delay2) {
          smoothParamChange(slot.effect.input._delay1.delayTime, delayMs / 1000, 0.03, 'linear')
          smoothParamChange(slot.effect.input._delay2.delayTime, (delayMs * 1.5) / 1000, 0.03, 'linear')
        }
        if (slot.effect.input._lfoGain1 && slot.effect.input._lfoGain2) {
          smoothParamChange(slot.effect.input._lfoGain1.gain, chorusModDepth(delayMs, slot.liveParams.depth), 0.02)
          smoothParamChange(slot.effect.input._lfoGain2.gain, chorusModDepth(delayMs * 1.5, slot.liveParams.depth) * 0.8, 0.02)
        }
      }
      break

    case 'phaser':
      // Update wet/dry mix and LFO parameters in real-time with smooth transitions
      if (params.wet !== undefined && slot.effect.input._wetGain && slot.effect.input._dryGain) {
        smoothParamChange(slot.effect.input._wetGain.gain, slot.liveParams.wet, 0.015)
        smoothParamChange(slot.effect.input._dryGain.gain, 1 - slot.liveParams.wet, 0.015)
      }
      if (params.rate !== undefined && slot.effect.input._lfo) {
        smoothParamChange(slot.effect.input._lfo.frequency, slot.liveParams.rate, 0.02)
      }
      if (params.depth !== undefined && slot.effect.input._lfoGain) {
        // Keep the same +/-500Hz max scale as effect creation
        smoothParamChange(slot.effect.input._lfoGain.gain, slot.liveParams.depth * 500, 0.02)
      }
      if (params.feedback !== undefined && slot.effect.input._feedbackGain) {
        smoothParamChange(slot.effect.input._feedbackGain.gain, slot.liveParams.feedback, 0.015)
      }
      break

    case 'tremolo':
      // Update LFO parameters in real-time with smooth transitions
      if (params.rate !== undefined || params.spread !== undefined) {
        if (params.rate !== undefined && slot.effect.input._lfo) {
          smoothParamChange(slot.effect.input._lfo.frequency, slot.liveParams.rate, 0.02)
        }
        // The stereo phase offset depends on both spread and rate
        if (slot.effect.input._spreadDelay) {
          smoothParamChange(slot.effect.input._spreadDelay.delayTime, (slot.liveParams.spread / 360) / slot.liveParams.rate, 0.03, 'linear')
        }
      }
      if (params.depth !== undefined && slot.effect.input._lfoGain && slot.effect.input._ampL && slot.effect.input._ampR) {
        smoothParamChange(slot.effect.input._lfoGain.gain, slot.liveParams.depth * 0.5, 0.015)
        smoothParamChange(slot.effect.input._ampL.gain, 1 - slot.liveParams.depth * 0.5, 0.015)
        smoothParamChange(slot.effect.input._ampR.gain, 1 - slot.liveParams.depth * 0.5, 0.015)
      }
      if (params.wet !== undefined && slot.effect.input._wetGain && slot.effect.input._dryGain) {
        smoothParamChange(slot.effect.input._wetGain.gain, slot.liveParams.wet, 0.015)
        smoothParamChange(slot.effect.input._dryGain.gain, 1 - slot.liveParams.wet, 0.015)
      }
      break

    case 'delay':
      // Update wet/dry mix, delay time, and feedback in real-time with smooth transitions
      if (params.wet !== undefined && slot.effect.input._wetGain && slot.effect.input._dryGain) {
        smoothParamChange(slot.effect.input._wetGain.gain, slot.liveParams.wet, 0.015)
        smoothParamChange(slot.effect.input._dryGain.gain, 1 - slot.liveParams.wet, 0.015)
      }
      if (params.delayTime !== undefined && slot.effect.input._delayNode) {
        smoothParamChange(slot.effect.input._delayNode.delayTime, slot.liveParams.delayTime, 0.05, 'linear')
      }
      if (params.feedback !== undefined && slot.effect.input._feedbackGain) {
        smoothParamChange(slot.effect.input._feedbackGain.gain, slot.liveParams.feedback, 0.015)
      }
      break

    case 'vibrato':
      // Update wet/dry mix and LFO parameters in real-time with smooth transitions
      if (params.wet !== undefined && slot.effect.input._wetGain && slot.effect.input._dryGain) {
        smoothParamChange(slot.effect.input._wetGain.gain, slot.liveParams.wet, 0.015)
        smoothParamChange(slot.effect.input._dryGain.gain, 1 - slot.liveParams.wet, 0.015)
      }
      if (params.rate !== undefined && slot.effect.input._lfo) {
        smoothParamChange(slot.effect.input._lfo.frequency, slot.liveParams.rate, 0.02)
      }
      if (params.depth !== undefined && slot.effect.input._lfoGain) {
        smoothParamChange(slot.effect.input._lfoGain.gain, slot.liveParams.depth * 0.01, 0.015)
      }
      if (params.type !== undefined && slot.effect.input._lfo) {
        const vibratoWaveforms = ['sine', 'square', 'sawtooth', 'triangle']
        slot.effect.input._lfo.type = vibratoWaveforms[Math.floor(slot.liveParams.type) % vibratoWaveforms.length]
      }
      break

    case 'autofilter':
      // Update wet/dry mix and LFO parameters in real-time with smooth transitions
      if (params.wet !== undefined && slot.effect.input._wetGain && slot.effect.input._dryGain) {
        smoothParamChange(slot.effect.input._wetGain.gain, slot.liveParams.wet, 0.015)
        smoothParamChange(slot.effect.input._dryGain.gain, 1 - slot.liveParams.wet, 0.015)
      }
      if (params.rate !== undefined && slot.effect.input._lfo) {
        smoothParamChange(slot.effect.input._lfo.frequency, slot.liveParams.rate, 0.02)
      }
      if ((params.baseFreq !== undefined || params.octaves !== undefined || params.depth !== undefined) && slot.effect.input._lfoGain && slot.effect.input._filter) {
        // Keep the sweep centered between baseFreq and the octave ceiling
        const maxFreq = Math.min(slot.liveParams.baseFreq * Math.pow(2, slot.liveParams.octaves), 15000)
        const sweepHalf = (maxFreq - slot.liveParams.baseFreq) / 2
        smoothParamChange(slot.effect.input._lfoGain.gain, sweepHalf * slot.liveParams.depth, 0.025)
        smoothParamChange(slot.effect.input._filter.frequency, slot.liveParams.baseFreq + sweepHalf, 0.025)
      }
      break

    case 'hallreverb':
      // Update wet/dry mix in real-time with smooth transitions
      if (params.wet !== undefined && slot.effect.input._wetGain && slot.effect.input._dryGain) {
        smoothParamChange(slot.effect.input._wetGain.gain, slot.liveParams.wet, 0.015)
        smoothParamChange(slot.effect.input._dryGain.gain, 1 - slot.liveParams.wet, 0.015)
      }
      // Note: roomSize, decay, and preDelay require effect recreation
      if (params.roomSize !== undefined || params.decay !== undefined || params.preDelay !== undefined) {
        scheduleChainRebuild(tabId)
      }
      break

    case 'autopanner':
      // Update LFO parameters in real-time with smooth transitions
      if (params.rate !== undefined && slot.effect.input._lfo) {
        smoothParamChange(slot.effect.input._lfo.frequency, slot.liveParams.rate, 0.02)
      }
      if (params.depth !== undefined && slot.effect.input._lfoGain) {
        smoothParamChange(slot.effect.input._lfoGain.gain, slot.liveParams.depth, 0.015)
      }
      if (params.type !== undefined && slot.effect.input._lfo) {
        const panWaveforms = ['sine', 'square', 'sawtooth', 'triangle']
        slot.effect.input._lfo.type = panWaveforms[Math.floor(slot.liveParams.type) % panWaveforms.length]
      }
      if (params.wet !== undefined && slot.effect.input._wetGain && slot.effect.input._dryGain) {
        smoothParamChange(slot.effect.input._wetGain.gain, slot.liveParams.wet, 0.015)
        smoothParamChange(slot.effect.input._dryGain.gain, 1 - slot.liveParams.wet, 0.015)
      }
      break

    case 'pitchshifter':
      if (params.wet !== undefined && slot.effect.input._wetGain && slot.effect.input._dryGain) {
        smoothParamChange(slot.effect.input._wetGain.gain, slot.liveParams.wet, 0.015)
        smoothParamChange(slot.effect.input._dryGain.gain, 1 - slot.liveParams.wet, 0.015)
      }
      // Pitch and window size apply live via smoothed ramps
      if ((params.pitch !== undefined || params.windowSize !== undefined) && slot.effect.input._applyPitchSettings) {
        slot.effect.input._applyPitchSettings()
      }
      break

    case 'tapestop':
      // Tape stop params are read from liveParams in the audio callback
      // Wet/dry mix can be updated in real-time
      if (params.wet !== undefined && slot.effect.input._wetGain && slot.effect.input._dryGain) {
        smoothParamChange(slot.effect.input._wetGain.gain, slot.liveParams.wet, 0.015)
        smoothParamChange(slot.effect.input._dryGain.gain, 1 - slot.liveParams.wet, 0.015)
      }
      // Mode change resets the cycle
      if (params.mode !== undefined && slot.effect.input._resetCycle) {
        slot.effect.input._resetCycle()
      }
      break

    case 'sidechainpump':
      // Sidechain pump params are read from liveParams in the audio callback
      // Wet/dry mix can be updated in real-time
      if (params.wet !== undefined && slot.effect.input._wetGain && slot.effect.input._dryGain) {
        smoothParamChange(slot.effect.input._wetGain.gain, slot.liveParams.wet, 0.015)
        smoothParamChange(slot.effect.input._dryGain.gain, 1 - slot.liveParams.wet, 0.015)
      }
      break

    case 'lofitape':
      if (params.wet !== undefined && slot.effect.input._wetGain && slot.effect.input._dryGain) {
        smoothParamChange(slot.effect.input._wetGain.gain, slot.liveParams.wet, 0.015)
        smoothParamChange(slot.effect.input._dryGain.gain, 1 - slot.liveParams.wet, 0.015)
      }
      if (params.wowDepth !== undefined && slot.effect.input._wowGain) {
        smoothParamChange(slot.effect.input._wowGain.gain, slot.liveParams.wowDepth * 0.008, 0.02)
      }
      if (params.flutterRate !== undefined && slot.effect.input._flutterLfo) {
        smoothParamChange(slot.effect.input._flutterLfo.frequency, slot.liveParams.flutterRate, 0.02)
      }
      if (params.saturation !== undefined && slot.effect.input._updateSaturationCurve) {
        slot.effect.input._updateSaturationCurve()
      }
      break

    default:
      console.warn(`🎵 Real-time parameter update not implemented for effect: ${slot.effectId}`)
      // For other effects that don't have real-time updates implemented,
      // recreate the effect with new parameters
      console.log(`🎵 Recreating ${effectId} for tab ${tabId} with new parameters`)
      scheduleChainRebuild(tabId)
  }
}

// Process audio stream for specific tab
async function processAudioStreamForTab(streamId, tabId, chainSpec) {
  console.log(`🎵 Processing audio stream for tab ${tabId} with ID:`, streamId)

  try {
    const ctx = initializeAudioContext()
    const state = getTabState(tabId)

    // Get the MediaStream using the stream ID
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId
        }
      }
    })

    console.log(`🎵 MediaStream obtained for tab ${tabId}:`, stream)

    // Create audio graph for this tab. Effects connect into destinationNode
    // (a plain gain bus), which feeds both the playback stream and an
    // analyser tap used by the popup's visualizer.
    state.sourceNode = new MediaStreamAudioSourceNode(ctx, { mediaStream: stream })
    state.streamDestination = new MediaStreamAudioDestinationNode(ctx)
    state.destinationNode = ctx.createGain()
    state.analyser = ctx.createAnalyser()
    state.analyser.fftSize = 512
    state.analyser.smoothingTimeConstant = 0.5
    state.destinationNode.connect(state.streamDestination)
    state.destinationNode.connect(state.analyser)

    // Build the effect chain from the spec sent by the popup
    buildChainForTab(chainSpec, tabId)

    console.log(`🎵 Audio graph connected for tab ${tabId} (${chainSpec.length} slot chain)`)

    // Play the processed stream
    state.audioElement = new Audio()
    state.audioElement.srcObject = state.streamDestination.stream
    state.audioElement.autoplay = true

    state.currentStream = stream

    console.log(`🎵 Audio processing setup complete for tab ${tabId}!`)

  } catch (error) {
    console.error(`🎵 Error setting up audio processing for tab ${tabId}:`, error)
    // Propagate so PROCESS_STREAM reports failure and the popup reverts,
    // instead of showing an on state with no audio processing behind it
    cleanupTabState(tabId)
    throw error
  }
}

// Listen for messages
// IMPORTANT: this listener must NOT be async. An async listener returns a
// Promise instead of the literal `true` Chrome needs to keep the response
// port open, so any sendResponse after an await races the port teardown and
// the sender sees "message port closed" even though processing succeeded.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // High-frequency visualizer polling: answer synchronously, no logging.
  // Current effect params ride along so the popup can mirror MIDI moves.
  if (message.type === "GET_VISUALIZER_FRAME") {
    const frameState = tabAudioState.get(message.tabId)
    sendResponse({
      bands: getVisualizerBands(message.tabId),
      chain: frameState && frameState.chain
        ? frameState.chain.map(s => ({ effectId: s.effectId, params: s.params }))
        : null,
      midi: { status: midiStatus, lastEvent: midiLastEvent }
    })
    return
  }

  // Popup asking whether a tab is genuinely capturing (storage can be stale)
  if (message.type === "GET_TAB_STATUS") {
    const statusState = tabAudioState.get(message.tabId)
    sendResponse({ capturing: !!(statusState && statusState.currentStream) })
    return
  }

  // Mapping updates pushed by the background when the popup saves changes
  if (message.type === "MIDI_MAPPINGS_UPDATED") {
    midiMappings = message.mappings || {}
    // A mapping change may follow a fresh permission grant; try again
    initMidi()
    return
  }

  console.log("🎵 MULTI-EFFECT OFFSCREEN received message:", message.type, message)
  console.log("🎵 MESSAGE RECEIVED - OFFSCREEN IS WORKING!")

  if (message.type === "PROCESS_STREAM") {
    console.log(`🎵 PROCESS_STREAM: tabId=${message.tabId}, chain=`, message.chain)

    // Start from a clean slate: a stale stream left over from a previous
    // capture blocks the new getUserMedia and the effect silently never engages
    const tabId = message.tabId
    cleanupTabState(tabId)
    getTabState(tabId)

    // Accept a chain spec; fall back to the legacy single-effect shape
    const chainSpec = Array.isArray(message.chain) && message.chain.length
      ? message.chain
      : [{ effectId: message.effectId || 'bitcrusher', params: message.params || {}, paramSpecs: message.paramSpecs || null }]

    processAudioStreamForTab(message.streamId, tabId, chainSpec)
      .then(() => {
        sendResponse({ success: true, message: "Stream processing started" })
      })
      .catch((error) => {
        console.error("🎵 Error processing stream:", error)
        sendResponse({ success: false, error: error.message })
      })
    return true // response is sent asynchronously, keep the port open
  }

  if (message.type === "STOP_STREAM") {
    // No tabId means this is the popup's broadcast copy; the background
    // re-forwards the real one with a tabId attached
    if (message.tabId === undefined) return
    cleanupTabState(message.tabId)
    console.log(`🎵 Stream stopped for tab ${message.tabId}`)
    sendResponse({ success: true, message: "Stream stopped" })
    return
  }

  if (message.type === "CLEAR_ALL_STREAMS") {
    // Clear all tab states
    for (const tabId of tabAudioState.keys()) {
      cleanupTabState(tabId)
    }
    console.log("🎵 All streams cleared")
    sendResponse({ success: true, message: "All streams cleared" })
    return
  }

  if (message.type === "UPDATE_EFFECT_PARAMS") {
    // Ignore the popup's tabId-less broadcast copy (see STOP_STREAM above)
    if (message.tabId === undefined) return
    updateEffectParamsForTab(message.effectId, message.params, message.tabId, message.slotIndex || 0)
    console.log(`🎵 Parameters updated for tab ${message.tabId}`)
    sendResponse({ success: true, message: "Parameters updated" })
    return
  }

  if (message.type === "SET_SLOT_ENABLED") {
    // Ignore the popup's tabId-less broadcast copy (see STOP_STREAM above)
    if (message.tabId === undefined) return
    const toggleState = tabAudioState.get(message.tabId)
    const toggleSlot = toggleState && toggleState.chain && toggleState.chain[message.slotIndex]
    if (!toggleSlot || !toggleSlot.wetGate) return
    toggleSlot.enabled = !!message.enabled
    smoothParamChange(toggleSlot.wetGate.gain, toggleSlot.enabled ? 1 : 0, 0.02, 'linear')
    smoothParamChange(toggleSlot.dryGate.gain, toggleSlot.enabled ? 0 : 1, 0.02, 'linear')
    console.log(`\u{1F3B5} Slot ${message.slotIndex} ${toggleSlot.enabled ? 'enabled' : 'bypassed'} for tab ${message.tabId}`)
    sendResponse({ success: true, message: "Slot toggled" })
    return
  }

  if (message.type === "SET_CHAIN") {
    // Ignore the popup's tabId-less broadcast copy (see STOP_STREAM above)
    if (message.tabId === undefined) return
    const chainState = tabAudioState.get(message.tabId)
    if (!chainState || !chainState.sourceNode) return
    try {
      buildChainForTab(message.chain || [], message.tabId)
      sendResponse({ success: true, message: "Chain updated" })
    } catch (error) {
      sendResponse({ success: false, error: error.message })
    }
    return
  }

  // Unknown message (e.g. popup-to-background traffic like START_CAPTURE):
  // don't respond and don't hold the port, so the real recipient's response wins
})

// Visualizer feed: compute compact log-spaced band energies (0..1) from a
// tab's analyser. The popup polls these via GET_VISUALIZER_FRAME messages.
const VISUALIZER_BAND_COUNT = 16
let visualizerFreqData = null

function getVisualizerBands(tabId) {
  const state = tabAudioState.get(tabId)
  const analyser = state && state.analyser
  if (!analyser) return null

  if (!visualizerFreqData || visualizerFreqData.length !== analyser.frequencyBinCount) {
    visualizerFreqData = new Uint8Array(analyser.frequencyBinCount)
  }
  analyser.getByteFrequencyData(visualizerFreqData)

  const bands = new Array(VISUALIZER_BAND_COUNT)
  const binCount = visualizerFreqData.length
  for (let b = 0; b < VISUALIZER_BAND_COUNT; b++) {
    const start = Math.floor(Math.pow(binCount, b / VISUALIZER_BAND_COUNT))
    const end = Math.max(start + 1, Math.floor(Math.pow(binCount, (b + 1) / VISUALIZER_BAND_COUNT)))
    let sum = 0
    for (let i = start; i < end && i < binCount; i++) sum += visualizerFreqData[i]
    bands[b] = sum / ((Math.min(end, binCount) - start) * 255)
  }
  return bands
}

// === MIDI control ===
// The offscreen document outlives the popup, so hardware knobs keep working
// while the popup is closed. Mappings are positional: a CC number maps to a
// knob index (0-3) of whichever effect is active on each capturing tab.
// Requires the one-time permission grant from midi-setup.html.
// NOTE: offscreen documents can only use chrome.runtime messaging, not
// chrome.storage, so mappings arrive from the background script: fetched
// once at startup and pushed on every change.
let midiMappings = {}
let midiAccess = null
let midiInitAttempted = false
// Diagnostics surfaced to the popup via visualizer frames
let midiStatus = 'initializing'
let midiLastEvent = ''

function requestMidiMappings() {
  try {
    chrome.runtime.sendMessage({ type: 'GET_MIDI_MAPPINGS' }, (response) => {
      const err = chrome.runtime.lastError
      if (!err && response && response.mappings) {
        midiMappings = response.mappings
      }
      initMidi()
    })
  } catch (e) {
    initMidi()
  }
}

function attachMidiInputs() {
  if (!midiAccess) return
  const names = []
  midiAccess.inputs.forEach((input) => {
    input.onmidimessage = handleMidiMessage
    names.push(input.name || 'unnamed')
  })
  midiStatus = names.length ? `listening (${names.join(', ')})` : 'listening (no inputs connected)'
  console.log(`🎵 MIDI: ${midiStatus}`)
}

function initMidi() {
  if (midiAccess || midiInitAttempted === 'pending') return
  midiInitAttempted = 'pending'
  if (!navigator.requestMIDIAccess) {
    midiInitAttempted = true
    midiStatus = 'web midi unsupported in offscreen document'
    console.log("🎵 MIDI:", midiStatus)
    return
  }
  navigator.requestMIDIAccess({ sysex: false })
    .then((access) => {
      midiAccess = access
      midiInitAttempted = true
      attachMidiInputs()
      access.onstatechange = attachMidiInputs
    })
    .catch((err) => {
      // Not granted yet; the popup's M button opens the setup page
      midiInitAttempted = true
      midiStatus = `access denied: ${err && err.message}`
      console.log("🎵 MIDI:", midiStatus)
    })
}

function handleMidiMessage(msg) {
  const [statusByte, cc, value] = msg.data
  if ((statusByte & 0xf0) !== 0xb0) return // control change messages only

  const binding = midiMappings[cc]
  if (!binding || typeof binding !== 'object' || !binding.slotId) {
    midiLastEvent = `cc ${cc} (unmapped)`
    return
  }

  // Bindings name a slot instance; find where it currently lives in each
  // capturing tab's chain, so mappings follow reorders and duplicate
  // effects stay independently controllable
  let applied = false
  for (const [tabId, state] of tabAudioState) {
    if (!state.chain) continue
    const slotIndex = state.chain.findIndex(s => s.id === binding.slotId)
    if (slotIndex === -1) continue
    const slot = state.chain[slotIndex]
    const spec = slot.paramSpecs && slot.paramSpecs[binding.knobIndex]
    if (!spec || !slot.effect) continue

    let paramValue = spec.min + (value / 127) * (spec.max - spec.min)
    if (spec.step) {
      paramValue = Math.round(paramValue / spec.step) * spec.step
    }
    paramValue = Math.max(spec.min, Math.min(spec.max, paramValue))
    if (!Number.isFinite(paramValue)) continue

    updateEffectParamsForTab(slot.effectId, { [spec.key]: paramValue }, tabId, slotIndex)
    applied = true
  }
  midiLastEvent = applied
    ? `cc ${cc} -> ${binding.slotId.slice(0, 10)} knob ${binding.knobIndex + 1}`
    : `cc ${cc} (bound effect not in any active chain)`
}

requestMidiMappings()

console.log("🎵 Multi-effect offscreen document ready and listening for messages")