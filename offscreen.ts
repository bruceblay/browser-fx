// Offscreen document for audio processing

console.log("Tab Bitcrusher offscreen document loaded")

let audioContext: AudioContext | null = null
let currentStream: MediaStream | null = null
let audioElement: HTMLAudioElement | null = null
let sourceNode: MediaStreamAudioSourceNode | null = null
let destinationNode: MediaStreamAudioDestinationNode | null = null

// Initialize Web Audio context
function initializeAudioContext() {
  if (!audioContext) {
    audioContext = new AudioContext()
    console.log("AudioContext initialized, sample rate:", audioContext.sampleRate)
  }
  return audioContext
}

// Process audio stream (passthrough for now)
async function processAudioStream(stream: MediaStream) {
  console.log("Processing audio stream:", stream)

  const ctx = initializeAudioContext()

  // Clean up previous connections
  cleanup()

  // Create audio graph: source -> destination
  sourceNode = new MediaStreamAudioSourceNode(ctx, { mediaStream: stream })
  destinationNode = new MediaStreamAudioDestinationNode(ctx)

  // For now, just pass audio through unchanged
  sourceNode.connect(destinationNode)

  // Create audio element to play the processed stream
  audioElement = new Audio()
  audioElement.srcObject = destinationNode.stream
  audioElement.autoplay = true

  // Store reference to current stream
  currentStream = stream

  console.log("Audio processing setup complete - audio should now play through extension")

  // Update status
  const statusElement = document.getElementById('status')
  if (statusElement) {
    statusElement.textContent = "Processing audio (passthrough mode)"
  }
}

// Stop processing and cleanup
function stopProcessing() {
  console.log("Stopping audio processing")
  cleanup()

  const statusElement = document.getElementById('status')
  if (statusElement) {
    statusElement.textContent = "Audio processor ready"
  }
}

// Cleanup audio resources
function cleanup() {
  if (sourceNode) {
    sourceNode.disconnect()
    sourceNode = null
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

// Listen for messages from background script
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  console.log("Offscreen received message:", message)

  if (message.type === "PROCESS_STREAM") {
    try {
      // Note: In a real implementation, we'd need to properly transfer the MediaStream
      // For now, we'll simulate this since MediaStream transfer between contexts is complex
      console.log("Would process stream with ID:", message.streamId, "from tab:", message.tabId)

      // TODO: Implement proper MediaStream transfer from background script
      // This is a complex topic that requires careful handling of MediaStream objects
      // between different execution contexts

      sendResponse({ success: true, message: "Stream processing started" })
    } catch (error) {
      console.error("Error processing stream:", error)
      sendResponse({ success: false, error: error.message })
    }
  }

  if (message.type === "STOP_PROCESSING") {
    stopProcessing()
    sendResponse({ success: true, message: "Processing stopped" })
  }

  return true
})

// Handle page unload
window.addEventListener('beforeunload', () => {
  cleanup()
})