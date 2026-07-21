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

// Fire-and-forget send to the offscreen document. A missing receiver just
// means no capture is running, so that rejection is expected and logged quietly.
function sendToOffscreen(message: Record<string, unknown>) {
  chrome.runtime.sendMessage(message).catch(() => {
    console.log(`No offscreen document to receive ${message.type}, skipping`)
  })
}

// Forward a message to the offscreen document with the active tab's id attached
function forwardWithActiveTab(message: Record<string, unknown>) {
  chrome.tabs.query({ active: true, currentWindow: true }).then(([activeTab]) => {
    sendToOffscreen({ ...message, tabId: activeTab?.id })
  })
}

async function startCapture(message: { chain?: unknown }) {
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
  sendToOffscreen({
    type: "STOP_STREAM",
    tabId: activeTab.id
  })

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

  if (offscreenContexts.length === 0) {
    throw new Error("No offscreen document found to process audio")
  }

  // Reduced wait time for faster audio start
  console.log("Brief wait for offscreen document to be ready...")
  await new Promise(resolve => setTimeout(resolve, 100))

  console.log("Sending PROCESS_STREAM message to offscreen document")
  let response: { success?: boolean; error?: string } | undefined
  try {
    response = await chrome.runtime.sendMessage({
      type: "PROCESS_STREAM",
      streamId: streamId,
      chain: message.chain,
      tabId: activeTab.id
    })
  } catch (error) {
    // The stream is already handed off at this point; a lost response port
    // does not mean processing failed, so don't report failure to the popup.
    const errorMessage = (error as Error)?.message || ""
    if (!errorMessage.includes("message port closed")) {
      throw error
    }
    console.log("PROCESS_STREAM response lost, assuming offscreen is processing")
    return
  }

  if (response && response.success === false) {
    throw new Error(response.error || "Offscreen document failed to process stream")
  }
  console.log("Message sent to offscreen document successfully")
}

// Push MIDI mapping changes to the offscreen document, which can't observe
// chrome.storage itself
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.midiMappings) {
    sendToOffscreen({
      type: 'MIDI_MAPPINGS_UPDATED',
      mappings: changes.midiMappings.newValue || {}
    })
  }
})

// Handle messages from popup. This listener must stay synchronous: an async
// listener returns a Promise instead of the literal `true` Chrome needs to
// keep the response port open, which makes responses flaky.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Popup-to-offscreen traffic; stay out of it
  if (message.type === "GET_VISUALIZER_FRAME" || message.type === "GET_TAB_STATUS") {
    return
  }

  // The offscreen document can't read chrome.storage, so it asks us for the
  // MIDI mappings at startup
  if (message.type === "GET_MIDI_MAPPINGS") {
    chrome.storage.local.get(['midiMappings']).then((result) => {
      sendResponse({ mappings: result.midiMappings || {} })
    })
    return true // response is sent asynchronously, keep the port open
  }

  console.log("Background received message:", message)

  if (message.type === "START_CAPTURE") {
    startCapture(message)
      .then(() => sendResponse({ success: true, message: "Audio capture started" }))
      .catch((error) => {
        console.error("Error in START_CAPTURE:", error)
        sendResponse({ success: false, error: (error as Error).message })
      })
    return true // response is sent asynchronously, keep the port open
  }

  if (message.type === "STOP_CAPTURE") {
    console.log("Processing STOP_CAPTURE request")
    forwardWithActiveTab({ type: "STOP_STREAM" })
    sendResponse({ success: true, message: "STOP_CAPTURE processed" })
    return
  }

  if (message.type === "UPDATE_EFFECT_PARAMS") {
    console.log("Processing UPDATE_EFFECT_PARAMS request:", message.effectId, message.params)
    forwardWithActiveTab({
      type: "UPDATE_EFFECT_PARAMS",
      slotIndex: message.slotIndex,
      effectId: message.effectId,
      params: message.params
    })
    sendResponse({ success: true, message: "Effect parameters updated" })
    return
  }

  if (message.type === "CLEAR_ALL_STREAMS") {
    console.log("Processing CLEAR_ALL_STREAMS request")
    sendToOffscreen({ type: "CLEAR_ALL_STREAMS" })
    sendResponse({ success: true, message: "CLEAR_ALL_STREAMS processed" })
    return
  }

  if (message.type === "SET_SLOT_ENABLED") {
    forwardWithActiveTab({
      type: "SET_SLOT_ENABLED",
      slotIndex: message.slotIndex,
      enabled: message.enabled
    })
    sendResponse({ success: true, message: "Slot toggled" })
    return
  }

  if (message.type === "SET_CHAIN") {
    console.log("Processing SET_CHAIN request:", (message.chain || []).length, "slots")
    forwardWithActiveTab({
      type: "SET_CHAIN",
      chain: message.chain
    })
    sendResponse({ success: true, message: "Chain updated" })
    return
  }
})

export default {}