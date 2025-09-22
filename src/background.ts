console.log("Browser FX background script loaded")

// Ensure offscreen document exists
async function ensureOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [chrome.runtime.getURL('offscreen.html')]
  })

  if (existingContexts.length > 0) {
    console.log("Offscreen document already exists")
    return
  }

  console.log("Creating offscreen document...")
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
    justification: 'Process tab audio with Web Audio API'
  })

  console.log("Offscreen document created")
  await new Promise(resolve => setTimeout(resolve, 100))
}

// Handle messages from popup
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  console.log("Background received message:", message)

  if (message.type === "START_CAPTURE") {
    try {
      console.log("Processing START_CAPTURE request")

      // Ensure offscreen document exists
      await ensureOffscreenDocument()

      // Get the active tab
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })

      if (!activeTab || !activeTab.id) {
        throw new Error("No active tab found")
      }

      console.log("Active tab found:", activeTab.id)

      // Capture tab audio using correct MV3 API
      const streamId = await chrome.tabCapture.getMediaStreamId()

      if (!streamId) {
        throw new Error("Failed to capture tab audio")
      }

      console.log("Got stream ID:", streamId)

      // Forward to offscreen document for processing
      chrome.runtime.sendMessage({
        type: "PROCESS_STREAM",
        streamId: streamId,
        effectId: message.effectId,
        params: message.params,
        tabId: activeTab.id
      })

      sendResponse({ success: true, message: "Audio capture started" })
      return true

    } catch (error) {
      console.error("Error in START_CAPTURE:", error)
      sendResponse({ success: false, error: (error as Error).message })
      return true
    }
  }

  if (message.type === "STOP_CAPTURE") {
    console.log("Processing STOP_CAPTURE request")

    // Forward stop message to offscreen document
    chrome.runtime.sendMessage({
      type: "STOP_STREAM"
    })

    sendResponse({ success: true, message: "STOP_CAPTURE processed" })
    return true
  }

  if (message.type === "UPDATE_EFFECT_PARAMS") {
    console.log("Processing UPDATE_EFFECT_PARAMS request")

    // Forward parameter updates to offscreen document
    chrome.runtime.sendMessage({
      type: "UPDATE_EFFECT_PARAMS",
      effectId: message.effectId,
      params: message.params
    })

    sendResponse({ success: true, message: "Effect parameters updated" })
    return true
  }

  if (message.type === "CLEAR_ALL_STREAMS") {
    console.log("Processing CLEAR_ALL_STREAMS request")

    // Forward clear message to offscreen document
    chrome.runtime.sendMessage({
      type: "CLEAR_ALL_STREAMS"
    })

    sendResponse({ success: true, message: "CLEAR_ALL_STREAMS processed" })
    return true
  }

  if (message.type === "SWITCH_EFFECT") {
    console.log("Processing SWITCH_EFFECT request")

    // Forward switch effect message to offscreen document
    chrome.runtime.sendMessage({
      type: "SWITCH_EFFECT",
      effectId: message.effectId,
      params: message.params
    })

    sendResponse({ success: true, message: "Effect switched" })
    return true
  }

  return true
})

export default {}