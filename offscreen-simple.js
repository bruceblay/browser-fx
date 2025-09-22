// Simple offscreen document without Tone.js for testing

console.log("🎵 Simple offscreen document loaded - testing connection")

let audioContext = null
let sourceNode = null
let destinationNode = null
let audioElement = null
let currentStream = null

// Simple bitcrusher using Web Audio API only
let bitDepthProcessor = null
let currentBitDepth = 4
let currentWetLevel = 1.0
let currentSampleReduction = 0.4

// Effect parameters that can be controlled
let effectParams = {
  bits: 8,        // Bit depth (1-16)
  normalRange: 0.4, // Sample rate reduction (0-1) - not used in simple version
  wet: 0.5        // Wet/dry mix (0-1)
}

// Initialize Web Audio context
function initializeAudioContext() {
  if (!audioContext) {
    audioContext = new AudioContext()
    console.log("AudioContext initialized, sample rate:", audioContext.sampleRate)
  }
  return audioContext
}

// Create a simple bitcrusher with dynamic parameters and wet/dry mix
function createSimpleBitcrusher(context) {
  const processor = context.createScriptProcessor(4096, 1, 1)
  let lastSample = 0
  let sampleCounter = 0

  processor.onaudioprocess = function(e) {
    const input = e.inputBuffer.getChannelData(0)
    const output = e.outputBuffer.getChannelData(0)

    const step = Math.pow(2, currentBitDepth - 1)
    const sampleRateReduction = Math.floor(currentSampleReduction * 32) + 1 // 1-33 samples

    for (let i = 0; i < input.length; i++) {
      // Apply sample rate reduction (hold samples for multiple cycles)
      if (sampleCounter % sampleRateReduction === 0) {
        lastSample = input[i]
      }
      sampleCounter++

      // Apply bitcrushing to the held sample
      const crushed = Math.round(lastSample * step) / step

      // Wet/dry mix: 0 = completely dry (original), 1 = completely wet (effected)
      output[i] = input[i] * (1 - currentWetLevel) + crushed * currentWetLevel
    }
  }

  return processor
}

// Update bitcrusher parameters in real-time
function updateBitcrusherParams(params) {
  console.log("🎵 Updating bitcrusher parameters:", params)

  if (params.bits !== undefined) {
    currentBitDepth = Math.max(1, Math.min(16, params.bits))
    console.log("🎵 Bit depth updated to:", currentBitDepth)
  }

  if (params.wet !== undefined) {
    currentWetLevel = Math.max(0, Math.min(1, params.wet))
    console.log("🎵 Wet level updated to:", currentWetLevel)
  }

  if (params.normalRange !== undefined) {
    currentSampleReduction = Math.max(0, Math.min(1, params.normalRange))
    console.log("🎵 Sample rate reduction updated to:", currentSampleReduction)
  }

  // Update stored parameters
  Object.assign(effectParams, params)
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

    // Create simple bitcrusher with dynamic parameters
    bitDepthProcessor = createSimpleBitcrusher(ctx)

    // Connect: source -> bitcrusher -> destination
    sourceNode.connect(bitDepthProcessor)
    bitDepthProcessor.connect(destinationNode)

    console.log("🎵 Audio graph connected with simple bitcrusher")

    // Play the processed stream
    audioElement = new Audio()
    audioElement.srcObject = destinationNode.stream
    audioElement.autoplay = true

    currentStream = stream

    console.log("🎵 Audio processing setup complete - you should hear heavy bitcrushing!")

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
  if (bitDepthProcessor) {
    bitDepthProcessor.disconnect()
    bitDepthProcessor = null
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
  console.log("🎵 SIMPLE OFFSCREEN received message:", message.type, message)

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
    console.log("🎵 Parameter update received:", message.params)
    updateBitcrusherParams(message.params)
    sendResponse({ success: true, message: "Parameters updated" })
  }

  return true
})

console.log("🎵 Simple offscreen document ready and listening for messages")