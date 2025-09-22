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
    console.log("Offscreen document already exists")
    return
  }

  console.log("Creating offscreen document...")

  // Create offscreen document
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'Process tab audio with Web Audio API'
  })

  console.log("Offscreen document created")

  // Wait a moment for the document to initialize
  await new Promise(resolve => setTimeout(resolve, 100))
}

// Handle messages from popup
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  console.log("Background received message:", message)

  if (message.type === "SETUP_OFFSCREEN") {
    try {
      // Ensure offscreen document exists
      await ensureOffscreenDocument()
      sendResponse({ success: true, message: "Offscreen document ready" })
    } catch (error) {
      console.error("Error setting up offscreen:", error)
      sendResponse({ success: false, error: error.message })
    }
  }

  if (message.type === "PROCESS_STREAM") {
    try {
      // Ensure offscreen document exists before forwarding
      await ensureOffscreenDocument()

      // Forward stream processing message to offscreen document
      console.log("Forwarding PROCESS_STREAM to offscreen:", message.streamId)
      chrome.runtime.sendMessage({
        type: "PROCESS_STREAM",
        streamId: message.streamId,
        tabId: message.tabId
      })
      sendResponse({ success: true, message: "Stream processing forwarded to offscreen" })
    } catch (error) {
      console.error("Error forwarding stream processing:", error)
      sendResponse({ success: false, error: error.message })
    }
  }

  if (message.type === "UPDATE_EFFECT_PARAMS") {
    try {
      // Ensure offscreen document exists before forwarding
      await ensureOffscreenDocument()

      // Forward parameter updates to offscreen document
      console.log("Forwarding UPDATE_EFFECT_PARAMS to offscreen:", message.params)
      chrome.runtime.sendMessage({
        type: "UPDATE_EFFECT_PARAMS",
        params: message.params
      })
      sendResponse({ success: true, message: "Effect parameters forwarded to offscreen" })
    } catch (error) {
      console.error("Error forwarding effect parameters:", error)
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