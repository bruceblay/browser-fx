// Service worker for Tab Bitcrusher extension

console.log("Tab Bitcrusher background script loaded")

// Ensure offscreen document exists
async function ensureOffscreenDocument() {
  // Check if offscreen document already exists
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL('offscreen.html')]
  })

  if (existingContexts.length > 0) {
    return
  }

  // Create offscreen document
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'Process tab audio with Web Audio API'
  })
}

// Handle messages from popup
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  console.log("Background received message:", message)

  if (message.type === "CAPTURE_TAB") {
    try {
      // Get the current active tab
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })

      if (!activeTab?.id) {
        throw new Error("No active tab found")
      }

      console.log("Capturing audio from tab:", activeTab.id)

      // Capture tab audio (requires user gesture)
      const stream = await chrome.tabCapture.capture({
        audio: true,
        video: false
      })

      if (!stream) {
        throw new Error("Failed to capture tab audio")
      }

      console.log("Audio stream captured:", stream)

      // Ensure offscreen document exists
      await ensureOffscreenDocument()

      // Send stream to offscreen document for processing
      chrome.runtime.sendMessage({
        type: "PROCESS_STREAM",
        streamId: stream.id,
        tabId: activeTab.id
      })

      sendResponse({ success: true, message: "Audio capture started" })
    } catch (error) {
      console.error("Error capturing tab audio:", error)
      sendResponse({ success: false, error: error.message })
    }
  }

  if (message.type === "STOP_CAPTURE") {
    // Forward stop message to offscreen document
    chrome.runtime.sendMessage({
      type: "STOP_PROCESSING"
    })
    sendResponse({ success: true, message: "Audio capture stopped" })
  }

  return true // Keep message channel open for async response
})

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
  console.log("Extension startup")
})

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed")
})