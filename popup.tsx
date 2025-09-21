import { useState } from "react"

function IndexPopup() {
  const [isCapturing, setIsCapturing] = useState(false)
  const [status, setStatus] = useState("Ready")

  const handleCaptureTab = async () => {
    try {
      setIsCapturing(true)
      setStatus("Starting capture...")

      // Send message to background script to capture tab audio
      const response = await chrome.runtime.sendMessage({
        type: "CAPTURE_TAB"
      })

      if (response.success) {
        setStatus("Capturing audio (passthrough mode)")
      } else {
        throw new Error(response.error)
      }
    } catch (error) {
      console.error("Error capturing tab:", error)
      setStatus(`Error: ${error.message}`)
      setIsCapturing(false)
    }
  }

  const handleStopCapture = async () => {
    try {
      setStatus("Stopping capture...")

      const response = await chrome.runtime.sendMessage({
        type: "STOP_CAPTURE"
      })

      if (response.success) {
        setStatus("Ready")
        setIsCapturing(false)
      } else {
        throw new Error(response.error)
      }
    } catch (error) {
      console.error("Error stopping capture:", error)
      setStatus(`Error: ${error.message}`)
    }
  }

  return (
    <div
      style={{
        padding: 16,
        minWidth: 250,
        textAlign: "center"
      }}>
      <h3 style={{ margin: "0 0 16px 0" }}>Tab Bitcrusher</h3>

      <div style={{ marginBottom: 16 }}>
        Status: <span style={{ fontWeight: "bold" }}>{status}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {!isCapturing ? (
          <button
            onClick={handleCaptureTab}
            style={{
              padding: "8px 16px",
              backgroundColor: "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer"
            }}
          >
            Capture Tab Audio
          </button>
        ) : (
          <button
            onClick={handleStopCapture}
            style={{
              padding: "8px 16px",
              backgroundColor: "#f44336",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer"
            }}
          >
            Stop Capture
          </button>
        )}
      </div>

      <div style={{ marginTop: 12, fontSize: "12px", color: "#666" }}>
        {!isCapturing
          ? "Click to start processing audio from the current tab"
          : "Audio is being processed in passthrough mode"
        }
      </div>
    </div>
  )
}

export default IndexPopup
