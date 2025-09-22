console.log("Browser FX background script loaded")

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background received message:", message)

  if (message.type === "START_CAPTURE") {
    try {
      console.log("Processing START_CAPTURE request")
      sendResponse({ success: true, message: "START_CAPTURE processed (placeholder)" })
      return true
    } catch (error) {
      console.error("Error in START_CAPTURE:", error)
      sendResponse({ success: false, error: (error as Error).message })
      return true
    }
  }

  if (message.type === "STOP_CAPTURE") {
    console.log("Processing STOP_CAPTURE request")
    sendResponse({ success: true, message: "STOP_CAPTURE processed" })
    return true
  }

  return true
})

export default {}