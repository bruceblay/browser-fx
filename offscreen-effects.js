// Multi-effect offscreen document for Browser FX

console.log("🎵 Multi-effect offscreen document loaded")

let audioContext = null
let sourceNode = null
let destinationNode = null
let audioElement = null
let currentStream = null

// Current effect state
let currentEffect = null
let currentEffectId = "bitcrusher"
let currentEffectParams = {}

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
  // AutoWah
  sensitivity: 0.7,
  baseFreq: 500,
  octaves: 3
}

// Initialize Web Audio context
function initializeAudioContext() {
  if (!audioContext) {
    audioContext = new AudioContext()
    console.log("AudioContext initialized, sample rate:", audioContext.sampleRate)
  }
  return audioContext
}

// Bitcrusher Effect Implementation
function createBitcrusher(context, params) {
  const processor = context.createScriptProcessor(4096, 1, 1)
  let lastSample = 0
  let sampleCounter = 0

  // Initialize live params
  liveParams.bits = params.bits || 4
  liveParams.normalRange = params.normalRange || 0.4
  liveParams.wet = params.wet || 1.0

  processor.onaudioprocess = function(e) {
    const input = e.inputBuffer.getChannelData(0)
    const output = e.outputBuffer.getChannelData(0)

    // Use live parameters that can be updated in real-time
    const step = Math.pow(2, liveParams.bits - 1)
    const sampleRateReduction = Math.floor(liveParams.normalRange * 32) + 1

    for (let i = 0; i < input.length; i++) {
      // Apply sample rate reduction
      if (sampleCounter % sampleRateReduction === 0) {
        lastSample = input[i]
      }
      sampleCounter++

      // Apply bitcrushing
      const crushed = Math.round(lastSample * step) / step

      // Wet/dry mix using live parameter
      output[i] = input[i] * (1 - liveParams.wet) + crushed * liveParams.wet
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

// AutoWah Effect Implementation - Simplified and Musical
function createAutoWah(context, params) {
  console.log('🎵 AUTOWAH: Creating simple envelope-following wah filter')

  // Initialize live params with simpler, more musical defaults
  liveParams.sensitivity = params.sensitivity || 0.5  // 0-1 range, simpler
  liveParams.baseFreq = params.baseFreq || 400        // 400Hz - good midrange start
  liveParams.range = params.range || 2000             // Max frequency range
  liveParams.wet = params.wet || 0.7

  const filter = context.createBiquadFilter()
  const analyser = context.createAnalyser()
  const wetGain = context.createGain()
  const dryGain = context.createGain()
  const inputGain = context.createGain()
  const outputGain = context.createGain()

  // Set up filter - lowpass for classic wah sound
  filter.type = 'lowpass'
  filter.frequency.value = liveParams.baseFreq
  filter.Q.value = 8  // Higher Q for classic wah resonance

  // Set up analyser - simple and responsive
  analyser.fftSize = 256
  analyser.smoothingTimeConstant = 0.6

  // Set up wet/dry mix
  wetGain.gain.value = liveParams.wet
  dryGain.gain.value = 1 - liveParams.wet

  // Connect audio chain
  inputGain.connect(analyser)
  inputGain.connect(filter)
  inputGain.connect(dryGain)
  filter.connect(wetGain)

  wetGain.connect(outputGain)
  dryGain.connect(outputGain)

  // Simple envelope following - much cleaner
  let lastLevel = 0
  const updateFilter = () => {
    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteTimeDomainData(dataArray)  // Use time domain for RMS

    // Calculate RMS level (more musical than frequency domain)
    let sum = 0
    for (let i = 0; i < dataArray.length; i++) {
      const sample = (dataArray[i] - 128) / 128
      sum += sample * sample
    }
    const rms = Math.sqrt(sum / dataArray.length)

    // Smooth the envelope with sensitivity control
    const smoothing = 1 - liveParams.sensitivity * 0.5  // More sensitivity = less smoothing
    lastLevel = lastLevel * smoothing + rms * (1 - smoothing)

    // Map to frequency range linearly (more predictable)
    const normalizedLevel = Math.min(lastLevel * liveParams.sensitivity * 10, 1)
    const freq = liveParams.baseFreq + (normalizedLevel * liveParams.range)

    filter.frequency.value = Math.min(Math.max(freq, 100), 8000)

    requestAnimationFrame(updateFilter)
  }
  updateFilter()

  console.log('🎵 AUTOWAH: Effect created with parameters:', {
    sensitivity: liveParams.sensitivity,
    baseFreq: liveParams.baseFreq + 'Hz',
    range: liveParams.range + 'Hz',
    wet: liveParams.wet
  })

  // Store references
  inputGain._filter = filter
  inputGain._analyser = analyser
  inputGain._wetGain = wetGain
  inputGain._dryGain = dryGain

  return { input: inputGain, output: outputGain }
}

// Create effect based on ID and parameters
function createEffect(effectId, params) {
  const context = audioContext
  console.log(`🎵 Creating effect: ${effectId}`, params)
  console.log(`🎵 Available effects in switch: bitcrusher, reverb, distortion, chorus, phaser, autowah`)

  switch (effectId) {
    case 'bitcrusher':
      return createBitcrusher(context, params)

    case 'reverb':
      return createReverb(context, params)

    case 'distortion':
      return createDistortion(context, params)

    case 'chorus':
      console.log(`🎵 CREATING CHORUS EFFECT`)
      return createChorus(context, params)

    case 'phaser':
      console.log(`🎵 CREATING PHASER EFFECT`)
      return createPhaser(context, params)

    case 'autowah':
      console.log(`🎵 CREATING AUTOWAH EFFECT`)
      return createAutoWah(context, params)

    default:
      console.warn(`🎵 Unknown effect: ${effectId}`)
      return createBitcrusher(context, params) // Fallback to bitcrusher
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
    try {
      if (currentEffect.input && currentEffect.output) {
        // Complex effect with input/output nodes
        sourceNode.connect(currentEffect.input)
        currentEffect.output.connect(destinationNode)
      } else {
        // Simple effect (like bitcrusher ScriptProcessor)
        sourceNode.connect(currentEffect)
        currentEffect.connect(destinationNode)
      }
      console.log(`🎵 Audio chain reconnected with ${effectId}`)
    } catch (error) {
      console.error("🎵 Error reconnecting audio chain:", error)
    }
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

    case 'autowah':
      // Update wet/dry mix in real-time
      if (params.wet !== undefined && currentEffect.input._wetGain && currentEffect.input._dryGain) {
        currentEffect.input._wetGain.gain.value = liveParams.wet
        currentEffect.input._dryGain.gain.value = 1 - liveParams.wet
      }
      // Other parameters (sensitivity, baseFreq, range) are handled via liveParams automatically in the animation loop
      break

    default:
      console.warn(`🎵 Unknown effect for parameter update: ${currentEffectId}`)
  }
}

// Process audio stream
async function processAudioStream(streamId) {
  console.log("🎵 Processing audio stream with ID:", streamId)

  try {
    const ctx = initializeAudioContext()

    // Get the MediaStream using the stream ID
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId
        }
      }
    })

    console.log("🎵 MediaStream obtained from ID:", stream)

    // Create audio graph
    sourceNode = new MediaStreamAudioSourceNode(ctx, { mediaStream: stream })
    destinationNode = new MediaStreamAudioDestinationNode(ctx)

    // Create initial effect (bitcrusher by default with aggressive settings)
    const initialParams = currentEffectParams.bits ? currentEffectParams : {
      bits: 4,
      normalRange: 0.4,
      wet: 1.0
    }
    console.log("🎵 Initializing with params:", currentEffectId, initialParams)
    switchEffect(currentEffectId, initialParams)

    console.log(`🎵 Audio graph connected with ${currentEffectId} effect`)

    // Play the processed stream
    audioElement = new Audio()
    audioElement.srcObject = destinationNode.stream
    audioElement.autoplay = true

    currentStream = stream

    console.log(`🎵 Audio processing setup complete with ${currentEffectId}!`)

  } catch (error) {
    console.error("🎵 Error setting up audio processing:", error)
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

  if (message.type === "PROCESS_STREAM") {
    try {
      await processAudioStream(message.streamId)
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

  if (message.type === "UPDATE_EFFECT_PARAMS") {
    updateEffectParams(message.effectId, message.params)
    sendResponse({ success: true, message: "Parameters updated" })
  }

  if (message.type === "SWITCH_EFFECT") {
    switchEffect(message.effectId, message.params)
    sendResponse({ success: true, message: `Switched to ${message.effectId}` })
  }

  return true
})

console.log("🎵 Multi-effect offscreen document ready and listening for messages")