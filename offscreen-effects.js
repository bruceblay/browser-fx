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

// Get or create tab audio state
function getTabState(tabId) {
  if (!tabAudioState.has(tabId)) {
    tabAudioState.set(tabId, {
      sourceNode: null,
      destinationNode: null,
      audioElement: null,
      currentStream: null,
      currentEffect: null,
      currentEffectId: defaultEffectId,
      currentEffectParams: { ...defaultEffectParams },
      liveParams: {
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
    })
  }
  return tabAudioState.get(tabId)
}

// Clean up tab audio state
function cleanupTabState(tabId) {
  const state = tabAudioState.get(tabId)
  if (!state) return

  if (state.sourceNode) {
    state.sourceNode.disconnect()
  }
  if (state.currentEffect) {
    try {
      if (state.currentEffect.disconnect) {
        state.currentEffect.disconnect()
      } else if (state.currentEffect.output) {
        state.currentEffect.output.disconnect()
      }
    } catch (error) {
      console.warn("Error disconnecting effect:", error)
    }
  }
  if (state.destinationNode) {
    state.destinationNode.disconnect()
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
  const processor = context.createScriptProcessor(4096, 1, 1)
  let lastSample = 0
  let sampleCounter = 0

  // Initialize tab-specific live params
  tabLiveParams.bits = params.bits || 4
  tabLiveParams.normalRange = params.normalRange || 0.4
  tabLiveParams.wet = params.wet || 1.0

  processor.onaudioprocess = function(e) {
    const input = e.inputBuffer.getChannelData(0)
    const output = e.outputBuffer.getChannelData(0)

    // Use tab-specific parameters that can be updated in real-time
    const step = Math.pow(2, tabLiveParams.bits - 1)
    const sampleRateReduction = Math.floor(tabLiveParams.normalRange * 32) + 1

    for (let i = 0; i < input.length; i++) {
      // Apply sample rate reduction
      if (sampleCounter % sampleRateReduction === 0) {
        lastSample = input[i]
      }
      sampleCounter++

      // Apply bitcrushing
      const crushed = Math.round(lastSample * step) / step

      // Wet/dry mix using tab-specific parameter
      output[i] = input[i] * (1 - tabLiveParams.wet) + crushed * tabLiveParams.wet
    }
  }

  return processor
}

// Simple Reverb Effect Implementation
function createReverb(context, params) {
  // Initialize live params
  liveParams.roomSize = params.roomSize || 0.7
  liveParams.decay = params.decay || 2.0
  liveParams.wet = params.wet || 0.3

  // Create convolver for reverb
  const convolver = context.createConvolver()
  const wetGain = context.createGain()
  const dryGain = context.createGain()
  const outputGain = context.createGain()

  // Create impulse response for reverb
  const length = context.sampleRate * liveParams.decay
  const impulse = context.createBuffer(2, length, context.sampleRate)

  for (let channel = 0; channel < 2; channel++) {
    const channelData = impulse.getChannelData(channel)
    for (let i = 0; i < length; i++) {
      const n = length - i
      channelData[i] = (Math.random() * 2 - 1) * Math.pow(n / length, liveParams.roomSize)
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
function createDistortion(context, params) {
  // Initialize live params
  liveParams.amount = params.amount || 0.5
  liveParams.tone = params.tone || 0.5
  liveParams.wet = params.wet || 0.8

  // Create waveshaper for distortion
  const waveshaper = context.createWaveShaper()
  const filter = context.createBiquadFilter()
  const wetGain = context.createGain()
  const dryGain = context.createGain()
  const inputGain = context.createGain()
  const outputGain = context.createGain()

  // Create more aggressive distortion curve
  function updateDistortionCurve() {
    const samples = 44100
    const curve = new Float32Array(samples)

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1

      // More aggressive distortion curve with better scaling
      const drive = 1 + liveParams.amount * 50  // 1 to 51 drive
      let y = x * drive

      // Apply different types of clipping/shaping based on drive amount
      if (liveParams.amount < 0.3) {
        // Soft clipping for lower amounts
        y = Math.tanh(y)
      } else if (liveParams.amount < 0.7) {
        // Harder clipping for medium amounts
        y = y / (1 + Math.abs(y))
      } else {
        // Hard clipping for extreme amounts
        y = Math.max(-0.8, Math.min(0.8, y))
      }

      curve[i] = y
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
function createChorus(context, params) {
  console.log('🎵 CHORUS: Creating Tone.js-style chorus effect')

  // Initialize live params with Tone.js-based defaults
  liveParams.rate = params.rate || 2.0
  liveParams.depth = params.depth || 0.6
  liveParams.delay = params.delay || 5      // Now in milliseconds (2-20ms range)
  liveParams.wet = params.wet || 0.7

  // Create delay lines for chorus
  const delay1 = context.createDelay(0.1)
  const delay2 = context.createDelay(0.1)
  const lfo1 = context.createOscillator()
  const lfo2 = context.createOscillator()
  const lfoGain1 = context.createGain()
  const lfoGain2 = context.createGain()
  const wetGain = context.createGain()
  const dryGain = context.createGain()
  const inputGain = context.createGain()
  const outputGain = context.createGain()

  // Set up delay times - convert milliseconds to seconds
  delay1.delayTime.value = liveParams.delay / 1000    // Convert ms to seconds
  delay2.delayTime.value = (liveParams.delay * 1.2) / 1000  // Slightly offset second delay

  // Set up LFOs based on parameters
  lfo1.frequency.value = liveParams.rate
  lfo2.frequency.value = liveParams.rate * 1.3
  lfo1.type = 'sine'
  lfo2.type = 'sine'

  // Set up LFO depth based on parameters
  lfoGain1.gain.value = liveParams.depth * 0.01
  lfoGain2.gain.value = liveParams.depth * 0.008

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
  delay1.connect(wetGain)
  delay2.connect(wetGain)

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
function createPhaser(context, params) {
  console.log('🎵 PHASER: Creating classic 4-stage phaser')

  // Initialize live params with classic phaser values
  liveParams.rate = params.rate || 1.0      // 1Hz default - musical sweet spot
  liveParams.depth = params.depth || 0.7    // 0-1 depth, simpler than octaves
  liveParams.feedback = params.feedback || 0.3  // Feedback for richer phasing
  liveParams.wet = params.wet || 0.5        // 50/50 mix for classic phaser

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

// Tremolo Effect Implementation
function createTremolo(context, params) {
  console.log('🎵 TREMOLO: Creating tremolo effect')

  // Initialize live params
  liveParams.rate = params.rate || 4.0    // 4Hz default
  liveParams.depth = params.depth || 0.5  // 0-1 depth
  liveParams.wet = params.wet || 1.0      // Full wet for tremolo

  const lfo = context.createOscillator()
  const lfoGain = context.createGain()
  const amplitude = context.createGain()
  const wetGain = context.createGain()
  const dryGain = context.createGain()
  const inputGain = context.createGain()
  const outputGain = context.createGain()

  // Set up LFO
  lfo.frequency.value = liveParams.rate
  lfo.type = 'sine'
  lfoGain.gain.value = liveParams.depth * 0.5  // Scale depth
  amplitude.gain.value = 1 - liveParams.depth * 0.5  // DC offset

  // Set up wet/dry mix
  wetGain.gain.value = liveParams.wet
  dryGain.gain.value = 1 - liveParams.wet

  // Connect LFO to amplitude modulation
  lfo.connect(lfoGain)
  lfoGain.connect(amplitude.gain)

  // Connect audio chain
  inputGain.connect(amplitude)
  inputGain.connect(dryGain)
  amplitude.connect(wetGain)

  wetGain.connect(outputGain)
  dryGain.connect(outputGain)

  // Start LFO
  lfo.start()

  // Store references
  inputGain._lfo = lfo
  inputGain._lfoGain = lfoGain
  inputGain._amplitude = amplitude
  inputGain._wetGain = wetGain
  inputGain._dryGain = dryGain

  return { input: inputGain, output: outputGain }
}

// Ping Pong Delay Effect Implementation
function createPingPongDelay(context, params) {
  console.log('🎵 PINGPONG: Creating ping pong delay effect')

  // Initialize live params
  liveParams.delayTime = params.delayTime || 0.3   // 300ms default
  liveParams.feedback = params.feedback || 0.4     // 40% feedback
  liveParams.wet = params.wet || 0.4               // 40% wet

  const delayL = context.createDelay(1)
  const delayR = context.createDelay(1)
  const feedbackL = context.createGain()
  const feedbackR = context.createGain()
  const wetGain = context.createGain()
  const dryGain = context.createGain()
  const inputGain = context.createGain()
  const outputGain = context.createGain()
  const merger = context.createChannelMerger(2)
  const splitter = context.createChannelSplitter(2)

  // Set up delays
  delayL.delayTime.value = liveParams.delayTime
  delayR.delayTime.value = liveParams.delayTime

  // Set up feedback
  feedbackL.gain.value = liveParams.feedback
  feedbackR.gain.value = liveParams.feedback

  // Set up wet/dry mix
  wetGain.gain.value = liveParams.wet
  dryGain.gain.value = 1 - liveParams.wet

  // Connect ping pong delay chain
  inputGain.connect(splitter)
  splitter.connect(delayL, 0)  // Left input to left delay
  splitter.connect(delayR, 1)  // Right input to right delay

  // Cross feedback for ping pong effect
  delayL.connect(feedbackR)
  delayR.connect(feedbackL)
  feedbackL.connect(delayL)
  feedbackR.connect(delayR)

  // Output
  delayL.connect(merger, 0, 1)  // Left delay to right output
  delayR.connect(merger, 0, 0)  // Right delay to left output
  merger.connect(wetGain)

  inputGain.connect(dryGain)
  wetGain.connect(outputGain)
  dryGain.connect(outputGain)

  // Store references
  inputGain._delayL = delayL
  inputGain._delayR = delayR
  inputGain._feedbackL = feedbackL
  inputGain._feedbackR = feedbackR
  inputGain._wetGain = wetGain
  inputGain._dryGain = dryGain

  return { input: inputGain, output: outputGain }
}

// Vibrato Effect Implementation
function createVibrato(context, params) {
  console.log('🎵 VIBRATO: Creating vibrato effect')

  // Initialize live params
  liveParams.rate = params.rate || 5.0     // 5Hz default
  liveParams.depth = params.depth || 0.02  // 2% pitch variation
  liveParams.wet = params.wet || 1.0       // Full wet for vibrato

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
  lfo.frequency.value = liveParams.rate
  lfo.type = 'sine'
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
  tabLiveParams.rate = params.rate || 2.0        // 2Hz sweep rate
  tabLiveParams.baseFreq = params.baseFreq || 200 // 200Hz base frequency
  tabLiveParams.octaves = params.octaves || 3     // 3 octave sweep range
  tabLiveParams.wet = params.wet || 0.8           // 80% wet

  const filter = context.createBiquadFilter()
  const lfo = context.createOscillator()
  const lfoGain = context.createGain()
  const wetGain = context.createGain()
  const dryGain = context.createGain()
  const inputGain = context.createGain()
  const outputGain = context.createGain()

  // Set up filter
  filter.type = 'lowpass'
  filter.frequency.value = tabLiveParams.baseFreq
  filter.Q.value = 2  // Moderate resonance

  // Set up LFO for filter sweep
  lfo.frequency.value = tabLiveParams.rate
  lfo.type = 'sine'
  // Calculate sweep range based on octaves
  const maxFreq = tabLiveParams.baseFreq * Math.pow(2, tabLiveParams.octaves)
  lfoGain.gain.value = (maxFreq - tabLiveParams.baseFreq) / 2

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
  tabLiveParams.pitch = params.pitch || 0        // 0 semitones (no shift)
  tabLiveParams.windowSize = params.windowSize || 0.05  // 50ms window
  tabLiveParams.overlap = params.overlap || 0.5   // 50% overlap
  tabLiveParams.wet = params.wet || 1.0           // 100% wet

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

  // Convert semitones to frequency ratio
  const pitchRatio = Math.pow(2, tabLiveParams.pitch / 12)

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

  return { input: inputGain, output: outputGain }
}

// Auto Panner Effect Implementation
function createAutoPanner(context, params, tabLiveParams) {
  console.log('🎵 AUTOPANNER: Creating auto panner effect')

  // Initialize live params
  tabLiveParams.rate = params.rate || 1.0      // 1Hz panning
  tabLiveParams.depth = params.depth || 0.8    // 80% depth
  tabLiveParams.type = params.type || 0        // Sine wave
  tabLiveParams.wet = params.wet || 1.0        // 100% wet

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
  tabLiveParams.roomSize = params.roomSize || 0.8
  tabLiveParams.decay = params.decay || 4.0
  tabLiveParams.preDelay = params.preDelay || 0.03
  tabLiveParams.damping = params.damping || 6000
  tabLiveParams.wet = params.wet || 0.4

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

  for (let channel = 0; channel < 2; channel++) {
    const channelData = impulse.getChannelData(channel)
    for (let i = 0; i < length; i++) {
      const n = length - i
      // Create hall-like reverb with early reflections
      const earlyReflection = Math.random() * 0.3 * Math.pow(n / length, 0.5)
      const lateReverb = (Math.random() * 2 - 1) * Math.pow(n / length, tabLiveParams.roomSize)
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

// Create effect based on ID and parameters
function createEffect(effectId, params, tabLiveParams) {
  const context = audioContext
  console.log(`🎵 Creating effect: ${effectId}`, params)
  console.log(`🎵 Available effects in switch: bitcrusher, reverb, distortion, chorus, phaser, tremolo, pingpongdelay, vibrato, autofilter`)

  let result
  switch (effectId) {
    case 'bitcrusher':
      result = createBitcrusher(context, params, tabLiveParams)
      console.log(`🎵 BITCRUSHER created:`, typeof result, result)
      return result

    case 'reverb':
      result = createReverb(context, params)
      console.log(`🎵 REVERB created:`, typeof result, result)
      return result

    case 'distortion':
      result = createDistortion(context, params)
      console.log(`🎵 DISTORTION created:`, typeof result, result)
      return result

    case 'chorus':
      console.log(`🎵 CREATING CHORUS EFFECT`)
      result = createChorus(context, params)
      console.log(`🎵 CHORUS created:`, typeof result, result)
      return result

    case 'phaser':
      console.log(`🎵 CREATING PHASER EFFECT`)
      result = createPhaser(context, params)
      console.log(`🎵 PHASER created:`, typeof result, result)
      return result

    case 'tremolo':
      console.log(`🎵 CREATING TREMOLO EFFECT`)
      result = createTremolo(context, params)
      console.log(`🎵 TREMOLO created:`, typeof result, result)
      return result

    case 'pingpongdelay':
      console.log(`🎵 CREATING PINGPONG DELAY EFFECT`)
      result = createPingPongDelay(context, params)
      console.log(`🎵 PINGPONG DELAY created:`, typeof result, result)
      return result

    case 'vibrato':
      console.log(`🎵 CREATING VIBRATO EFFECT`)
      result = createVibrato(context, params)
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

    default:
      console.warn(`🎵 Unknown effect: ${effectId} - FALLING BACK TO BITCRUSHER!`)
      result = createBitcrusher(context, params, tabLiveParams)
      console.log(`🎵 DEFAULT (bitcrusher fallback) created:`, typeof result, result)
      return result
  }
}

// Switch to a new effect
function switchEffect(effectId, params) {
  console.log(`🎵 Switching to effect: ${effectId}`, params)

  // Ensure we have the audioContext
  if (!audioContext) {
    console.error("🎵 No audioContext available for effect switching")
    return
  }

  // Disconnect current effect if exists
  if (currentEffect) {
    try {
      if (sourceNode) {
        sourceNode.disconnect()
      }

      // Handle different effect node structures
      if (currentEffect.disconnect) {
        currentEffect.disconnect()
      } else if (currentEffect.input && currentEffect.output) {
        currentEffect.output.disconnect()
      }
    } catch (error) {
      console.warn("🎵 Error disconnecting current effect:", error)
    }
  }

  // Create new effect
  currentEffect = createEffect(effectId, params)
  currentEffectId = effectId
  currentEffectParams = params

  // Reconnect audio chain if we have active audio
  if (sourceNode && destinationNode) {
    console.log(`🎵 CONNECTING AUDIO: effect type=${typeof currentEffect}, has input=${!!currentEffect.input}, has output=${!!currentEffect.output}`)
    try {
      if (currentEffect.input && currentEffect.output) {
        // Complex effect with input/output nodes
        console.log(`🎵 COMPLEX EFFECT CONNECTION: sourceNode -> ${currentEffect.input.constructor.name} -> ${currentEffect.output.constructor.name} -> destinationNode`)
        sourceNode.connect(currentEffect.input)
        currentEffect.output.connect(destinationNode)
      } else {
        // Simple effect (like bitcrusher ScriptProcessor)
        console.log(`🎵 SIMPLE EFFECT CONNECTION: sourceNode -> ${currentEffect.constructor.name} -> destinationNode`)
        sourceNode.connect(currentEffect)
        currentEffect.connect(destinationNode)
      }
      console.log(`🎵 Audio chain reconnected successfully with ${effectId}`)
    } catch (error) {
      console.error("🎵 ERROR reconnecting audio chain:", error)
    }
  } else {
    console.warn(`🎵 No audio to connect: sourceNode=${!!sourceNode}, destinationNode=${!!destinationNode}`)
  }
}

// Switch to a new effect for specific tab
function switchEffectForTab(effectId, params, tabId) {
  console.log(`🎵 Switching to effect for tab ${tabId}: ${effectId}`, params)

  // Ensure we have the audioContext
  if (!audioContext) {
    console.error("🎵 No audioContext available for effect switching")
    return
  }

  const state = getTabState(tabId)

  // Disconnect current effect if exists
  if (state.currentEffect) {
    try {
      if (state.sourceNode) {
        state.sourceNode.disconnect()
      }

      // Handle different effect node structures
      if (state.currentEffect.disconnect) {
        state.currentEffect.disconnect()
      } else if (state.currentEffect.input && state.currentEffect.output) {
        state.currentEffect.output.disconnect()
      }
    } catch (error) {
      console.warn(`🎵 Error disconnecting current effect for tab ${tabId}:`, error)
    }
  }

  // Create new effect for this tab
  state.currentEffect = createEffect(effectId, params, state.liveParams)
  state.currentEffectId = effectId
  state.currentEffectParams = params

  // Reconnect audio chain if we have active audio
  if (state.sourceNode && state.destinationNode) {
    console.log(`🎵 CONNECTING AUDIO for tab ${tabId}: effect type=${typeof state.currentEffect}, has input=${!!state.currentEffect.input}, has output=${!!state.currentEffect.output}`)
    try {
      if (state.currentEffect.input && state.currentEffect.output) {
        // Complex effect with input/output nodes
        console.log(`🎵 COMPLEX EFFECT CONNECTION for tab ${tabId}: sourceNode -> ${state.currentEffect.input.constructor.name} -> ${state.currentEffect.output.constructor.name} -> destinationNode`)
        state.sourceNode.connect(state.currentEffect.input)
        state.currentEffect.output.connect(state.destinationNode)
      } else {
        // Simple effect (like bitcrusher ScriptProcessor)
        console.log(`🎵 SIMPLE EFFECT CONNECTION for tab ${tabId}: sourceNode -> ${state.currentEffect.constructor.name} -> destinationNode`)
        state.sourceNode.connect(state.currentEffect)
        state.currentEffect.connect(state.destinationNode)
      }
      console.log(`🎵 Audio chain reconnected successfully for tab ${tabId} with ${effectId}`)
    } catch (error) {
      console.error(`🎵 ERROR reconnecting audio chain for tab ${tabId}:`, error)
    }
  } else {
    console.warn(`🎵 No audio to connect for tab ${tabId}: sourceNode=${!!state.sourceNode}, destinationNode=${!!state.destinationNode}`)
  }
}

// Update parameters of current effect in real-time
function updateEffectParams(effectId, params) {
  console.log(`🎵 Updating effect params for ${effectId}:`, params)

  if (effectId !== currentEffectId) {
    console.warn(`🎵 Param update for inactive effect ${effectId} (current: ${currentEffectId})`)
    return
  }

  // Update live parameters
  Object.assign(liveParams, params)
  Object.assign(currentEffectParams, params)

  // Apply real-time updates based on effect type
  if (!currentEffect) return

  switch (currentEffectId) {
    case 'bitcrusher':
      // Bitcrusher parameters are updated automatically via liveParams in the audio callback
      break

    case 'reverb':
      // Update wet/dry mix in real-time
      if (params.wet !== undefined && currentEffect.input._wetGain && currentEffect.input._dryGain) {
        currentEffect.input._wetGain.gain.value = liveParams.wet
        currentEffect.input._dryGain.gain.value = 1 - liveParams.wet
      }
      // Note: roomSize and decay require effect recreation as they change the impulse response
      if (params.roomSize !== undefined || params.decay !== undefined) {
        console.log("🎵 Recreating reverb for roomSize/decay change")
        const newParams = { ...currentEffectParams }
        switchEffect(effectId, newParams)
      }
      break

    case 'distortion':
      // Update wet/dry mix in real-time
      if (params.wet !== undefined && currentEffect.input._wetGain && currentEffect.input._dryGain) {
        currentEffect.input._wetGain.gain.value = liveParams.wet
        currentEffect.input._dryGain.gain.value = 1 - liveParams.wet
      }
      // Update tone filter frequency in real-time
      if (params.tone !== undefined && currentEffect.input._filter) {
        currentEffect.input._filter.frequency.value = 2000 + (liveParams.tone * 8000)
      }
      // Update distortion curve in real-time
      if (params.amount !== undefined && currentEffect.input._updateDistortionCurve) {
        currentEffect.input._updateDistortionCurve()
      }
      break

    case 'chorus':
      // Update wet/dry mix in real-time
      if (params.wet !== undefined && currentEffect.input._wetGain && currentEffect.input._dryGain) {
        currentEffect.input._wetGain.gain.value = liveParams.wet
        currentEffect.input._dryGain.gain.value = 1 - liveParams.wet
      }
      // Update LFO parameters in real-time
      if (params.rate !== undefined && currentEffect.input._lfo1 && currentEffect.input._lfo2) {
        currentEffect.input._lfo1.frequency.value = liveParams.rate
        currentEffect.input._lfo2.frequency.value = liveParams.rate * 1.3
      }
      if (params.depth !== undefined && currentEffect.input._lfoGain1 && currentEffect.input._lfoGain2) {
        currentEffect.input._lfoGain1.gain.value = liveParams.depth * 0.01
        currentEffect.input._lfoGain2.gain.value = liveParams.depth * 0.008
      }
      // Note: delay time changes require effect recreation (now in milliseconds)
      if (params.delay !== undefined) {
        console.log("🎵 Recreating chorus for delay time change (ms)")
        const newParams = { ...currentEffectParams }
        switchEffect(currentEffectId, newParams)
      }
      break

    case 'phaser':
      // Update wet/dry mix in real-time
      if (params.wet !== undefined && currentEffect.input._wetGain && currentEffect.input._dryGain) {
        currentEffect.input._wetGain.gain.value = liveParams.wet
        currentEffect.input._dryGain.gain.value = 1 - liveParams.wet
      }
      // Update LFO parameters in real-time
      if (params.rate !== undefined && currentEffect.input._lfo) {
        currentEffect.input._lfo.frequency.value = liveParams.rate
      }
      if (params.depth !== undefined && currentEffect.input._lfoGain) {
        // Simple depth scaling
        currentEffect.input._lfoGain.gain.value = liveParams.depth * 500
      }
      if (params.feedback !== undefined && currentEffect.input._feedbackGain) {
        currentEffect.input._feedbackGain.gain.value = liveParams.feedback
      }
      break

    case 'tremolo':
      // Update wet/dry mix in real-time
      if (params.wet !== undefined && currentEffect.input._wetGain && currentEffect.input._dryGain) {
        currentEffect.input._wetGain.gain.value = liveParams.wet
        currentEffect.input._dryGain.gain.value = 1 - liveParams.wet
      }
      // Update LFO parameters in real-time
      if (params.rate !== undefined && currentEffect.input._lfo) {
        currentEffect.input._lfo.frequency.value = liveParams.rate
      }
      if (params.depth !== undefined && currentEffect.input._lfoGain) {
        currentEffect.input._lfoGain.gain.value = liveParams.depth * 0.5
        currentEffect.input._amplitude.gain.value = 1 - liveParams.depth * 0.5
      }
      break

    case 'pingpongdelay':
      // Update wet/dry mix in real-time
      if (params.wet !== undefined && currentEffect.input._wetGain && currentEffect.input._dryGain) {
        currentEffect.input._wetGain.gain.value = liveParams.wet
        currentEffect.input._dryGain.gain.value = 1 - liveParams.wet
      }
      // Update delay time in real-time
      if (params.delayTime !== undefined && currentEffect.input._delayL && currentEffect.input._delayR) {
        currentEffect.input._delayL.delayTime.value = liveParams.delayTime
        currentEffect.input._delayR.delayTime.value = liveParams.delayTime
      }
      // Update feedback in real-time
      if (params.feedback !== undefined && currentEffect.input._feedbackL && currentEffect.input._feedbackR) {
        currentEffect.input._feedbackL.gain.value = liveParams.feedback
        currentEffect.input._feedbackR.gain.value = liveParams.feedback
      }
      break

    case 'vibrato':
      // Update wet/dry mix in real-time
      if (params.wet !== undefined && currentEffect.input._wetGain && currentEffect.input._dryGain) {
        currentEffect.input._wetGain.gain.value = liveParams.wet
        currentEffect.input._dryGain.gain.value = 1 - liveParams.wet
      }
      // Update LFO parameters in real-time
      if (params.rate !== undefined && currentEffect.input._lfo) {
        currentEffect.input._lfo.frequency.value = liveParams.rate
      }
      if (params.depth !== undefined && currentEffect.input._lfoGain) {
        currentEffect.input._lfoGain.gain.value = liveParams.depth * 0.01
      }
      break

    case 'autofilter':
      // Update wet/dry mix in real-time
      if (params.wet !== undefined && currentEffect.input._wetGain && currentEffect.input._dryGain) {
        currentEffect.input._wetGain.gain.value = liveParams.wet
        currentEffect.input._dryGain.gain.value = 1 - liveParams.wet
      }
      // Update LFO rate in real-time
      if (params.rate !== undefined && currentEffect.input._lfo) {
        currentEffect.input._lfo.frequency.value = liveParams.rate
      }
      // Update filter parameters (requires recalculating LFO gain)
      if ((params.baseFreq !== undefined || params.octaves !== undefined) && currentEffect.input._lfoGain) {
        const maxFreq = liveParams.baseFreq * Math.pow(2, liveParams.octaves)
        currentEffect.input._lfoGain.gain.value = (maxFreq - liveParams.baseFreq) / 2
        currentEffect.input._filter.frequency.value = liveParams.baseFreq
      }
      break

    default:
      console.warn(`🎵 Unknown effect for parameter update: ${currentEffectId}`)
  }
}

// Update parameters for specific tab
function updateEffectParamsForTab(effectId, params, tabId) {
  console.log(`🎵 Updating effect params for tab ${tabId}, effect ${effectId}:`, params)

  const state = getTabState(tabId)

  if (effectId !== state.currentEffectId) {
    console.warn(`🎵 Param update for inactive effect ${effectId} on tab ${tabId} (current: ${state.currentEffectId})`)
    return
  }

  // Update live parameters for this tab
  Object.assign(state.liveParams, params)
  Object.assign(state.currentEffectParams, params)

  // Apply real-time updates based on effect type
  if (!state.currentEffect) return

  // Note: For simplicity, I'm only implementing the most commonly changed parameters
  // The bitcrusher parameters will update automatically via the tab's liveParams reference
  switch (state.currentEffectId) {
    case 'bitcrusher':
      // Bitcrusher parameters are updated automatically via liveParams in the audio callback
      break

    case 'reverb':
      // Update wet/dry mix in real-time
      if (params.wet !== undefined && state.currentEffect.input._wetGain && state.currentEffect.input._dryGain) {
        state.currentEffect.input._wetGain.gain.value = state.liveParams.wet
        state.currentEffect.input._dryGain.gain.value = 1 - state.liveParams.wet
      }
      // Note: roomSize and decay require effect recreation
      if (params.roomSize !== undefined || params.decay !== undefined) {
        console.log(`🎵 Recreating reverb for tab ${tabId} for roomSize/decay change`)
        switchEffectForTab(effectId, state.currentEffectParams, tabId)
      }
      break

    default:
      console.warn(`🎵 Real-time parameter update not implemented for effect: ${state.currentEffectId}`)
      // For other effects that don't have real-time updates implemented,
      // recreate the effect with new parameters
      console.log(`🎵 Recreating ${effectId} for tab ${tabId} with new parameters`)
      switchEffectForTab(effectId, state.currentEffectParams, tabId)
  }
}

// Process audio stream for specific tab
async function processAudioStreamForTab(streamId, tabId) {
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

    // Create audio graph for this tab
    state.sourceNode = new MediaStreamAudioSourceNode(ctx, { mediaStream: stream })
    state.destinationNode = new MediaStreamAudioDestinationNode(ctx)

    // Create initial effect with the parameters from the message
    const initialParams = state.currentEffectParams
    console.log(`🎵 Initializing tab ${tabId} with params:`, state.currentEffectId, initialParams)
    switchEffectForTab(state.currentEffectId, initialParams, tabId)

    console.log(`🎵 Audio graph connected for tab ${tabId} with ${state.currentEffectId} effect`)

    // Play the processed stream
    state.audioElement = new Audio()
    state.audioElement.srcObject = state.destinationNode.stream
    state.audioElement.autoplay = true

    state.currentStream = stream

    console.log(`🎵 Audio processing setup complete for tab ${tabId} with ${state.currentEffectId}!`)

  } catch (error) {
    console.error(`🎵 Error setting up audio processing for tab ${tabId}:`, error)
  }
}

// Cleanup
function cleanup() {
  if (sourceNode) {
    sourceNode.disconnect()
    sourceNode = null
  }
  if (currentEffect) {
    try {
      if (currentEffect.disconnect) {
        currentEffect.disconnect()
      } else if (currentEffect.output) {
        currentEffect.output.disconnect()
      }
    } catch (error) {
      console.warn("Error disconnecting effect:", error)
    }
    currentEffect = null
  }
  if (destinationNode) {
    destinationNode.disconnect()
    destinationNode = null
  }
  if (audioElement) {
    audioElement.pause()
    audioElement.srcObject = null
    audioElement = null
  }
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop())
    currentStream = null
  }
}

// Listen for messages
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  console.log("🎵 MULTI-EFFECT OFFSCREEN received message:", message.type, message)
  console.log("🎵 MESSAGE RECEIVED - OFFSCREEN IS WORKING!")

  if (message.type === "PROCESS_STREAM") {
    try {
      console.log(`🎵 PROCESS_STREAM: tabId=${message.tabId}, effectId=${message.effectId}, params=`, message.params)

      // Get tab state
      const tabId = message.tabId
      const state = getTabState(tabId)

      // Set the effect for this tab
      state.currentEffectId = message.effectId || 'bitcrusher'
      state.currentEffectParams = message.params || {}
      console.log(`🎵 AFTER SETTING for tab ${tabId}: currentEffectId=${state.currentEffectId}, currentEffectParams=`, state.currentEffectParams)

      await processAudioStreamForTab(message.streamId, tabId)
      sendResponse({ success: true, message: "Stream processing started" })
    } catch (error) {
      console.error("🎵 Error processing stream:", error)
      sendResponse({ success: false, error: error.message })
    }
  }

  if (message.type === "STOP_PROCESSING") {
    cleanup()
    sendResponse({ success: true, message: "Processing stopped" })
  }

  if (message.type === "STOP_STREAM") {
    const tabId = message.tabId
    if (tabId) {
      cleanupTabState(tabId)
      console.log(`🎵 Stream stopped for tab ${tabId}`)
    } else {
      console.warn("🎵 STOP_STREAM received without tabId")
    }
    sendResponse({ success: true, message: "Stream stopped" })
  }

  if (message.type === "CLEAR_ALL_STREAMS") {
    // Clear all tab states
    for (const tabId of tabAudioState.keys()) {
      cleanupTabState(tabId)
    }
    console.log("🎵 All streams cleared")
    sendResponse({ success: true, message: "All streams cleared" })
  }

  if (message.type === "UPDATE_EFFECT_PARAMS") {
    const tabId = message.tabId
    if (tabId) {
      updateEffectParamsForTab(message.effectId, message.params, tabId)
      console.log(`🎵 Parameters updated for tab ${tabId}`)
    } else {
      console.warn("🎵 UPDATE_EFFECT_PARAMS received without tabId")
    }
    sendResponse({ success: true, message: "Parameters updated" })
  }

  if (message.type === "SWITCH_EFFECT") {
    const tabId = message.tabId
    if (tabId) {
      switchEffectForTab(message.effectId, message.params, tabId)
      console.log(`🎵 Switched to ${message.effectId} for tab ${tabId}`)
    } else {
      console.warn("🎵 SWITCH_EFFECT received without tabId")
    }
    sendResponse({ success: true, message: `Switched to ${message.effectId}` })
  }

  return true
})

console.log("🎵 Multi-effect offscreen document ready and listening for messages")