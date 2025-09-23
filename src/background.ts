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

  const extensionId = chrome.runtime.id
  const offscreenUrl = `chrome-extension://${extensionId}/offscreen.html`
  console.log("Offscreen document created")
  console.log("🔍 TO DEBUG OFFSCREEN: Navigate to:", offscreenUrl)
  await new Promise(resolve => setTimeout(resolve, 50))
}

// Handle messages from popup
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  console.log("Background received message:", message)

  if (message.type === "START_CAPTURE") {
    try {
      console.log("Processing START_CAPTURE request")

      // Parallelize offscreen creation and tab query for speed
      const [_, [activeTab]] = await Promise.all([
        ensureOffscreenDocument(),
        chrome.tabs.query({ active: true, currentWindow: true })
      ])

      if (!activeTab || !activeTab.id) {
        throw new Error("No active tab found")
      }

      console.log("Active tab found:", activeTab.id)

      // Quick cleanup attempt (don't wait for response to avoid timeout)
      console.log("Attempting quick cleanup for tab:", activeTab.id)
      try {
        chrome.runtime.sendMessage({
          type: "STOP_STREAM",
          tabId: activeTab.id
        }).catch(() => {
          console.log("Quick cleanup message failed (expected if no offscreen yet)")
        })
      } catch (error) {
        console.log("Quick cleanup failed:", error)
      }

      // Capture tab audio using correct MV3 API
      const streamId = await chrome.tabCapture.getMediaStreamId()

      if (!streamId) {
        throw new Error("Failed to capture tab audio")
      }

      console.log("Got stream ID:", streamId)

      // Forward to offscreen document for processing
      console.log("Sending PROCESS_STREAM to offscreen document")
      const offscreenContexts = await chrome.runtime.getContexts({
        contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT]
      })
      console.log("Found offscreen contexts:", offscreenContexts.length)

      if (offscreenContexts.length > 0) {
        // Reduced wait time for faster audio start
        console.log("Brief wait for offscreen document to be ready...")
        await new Promise(resolve => setTimeout(resolve, 100))

        console.log("Sending PROCESS_STREAM message to offscreen document")
        await chrome.runtime.sendMessage({
          type: "PROCESS_STREAM",
          streamId: streamId,
          effectId: message.effectId,
          params: message.params,
          tabId: activeTab.id
        })
        console.log("Message sent to offscreen document successfully")
      } else {
        throw new Error("No offscreen document found to process audio")
      }

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

    // Get the active tab ID
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })

    // Forward stop message to offscreen document
    console.log("Sending STOP_STREAM to offscreen document")
    chrome.runtime.sendMessage({
      type: "STOP_STREAM",
      tabId: activeTab?.id
    }).catch(error => {
      console.error("Failed to send STOP_STREAM:", error)
    })

    sendResponse({ success: true, message: "STOP_CAPTURE processed" })
    return true
  }

  if (message.type === "UPDATE_EFFECT_PARAMS") {
    console.log("Processing UPDATE_EFFECT_PARAMS request:", message.effectId, message.params)

    // Get the active tab ID
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })

    // Forward parameter updates to offscreen document
    console.log("Sending UPDATE_EFFECT_PARAMS to offscreen document")
    chrome.runtime.sendMessage({
      type: "UPDATE_EFFECT_PARAMS",
      effectId: message.effectId,
      params: message.params,
      tabId: activeTab?.id
    }).catch(error => {
      console.error("Failed to send UPDATE_EFFECT_PARAMS:", error)
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
    console.log("Processing SWITCH_EFFECT request:", message.effectId, message.params)

    // Get the active tab ID
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })

    // Forward switch effect message to offscreen document
    console.log("Sending SWITCH_EFFECT to offscreen document")
    chrome.runtime.sendMessage({
      type: "SWITCH_EFFECT",
      effectId: message.effectId,
      params: message.params,
      tabId: activeTab?.id
    }).catch(error => {
      console.error("Failed to send SWITCH_EFFECT:", error)
    })

    sendResponse({ success: true, message: "Effect switched" })
    return true
  }

  return true
})

export default {}