import { useState, useEffect } from "react"

function IndexPopup() {
  const [isCapturing, setIsCapturing] = useState(false)
  const [status, setStatus] = useState("Ready")

  // Bitcrusher effect parameters
  const [effectParams, setEffectParams] = useState({
    bits: 8,        // Bit depth (1-16)
    normalRange: 0.4, // Sample rate reduction (0-1)
    wet: 0.5        // Wet/dry mix (0-1)
  })

  // Load state on popup open
  useEffect(() => {
    if (chrome?.storage?.local) {
      chrome.storage.local.get(['isCapturing', 'effectParams'], (result) => {
        if (chrome.runtime.lastError) {
          console.log("Error loading state:", chrome.runtime.lastError)
          return
        }
        if (result.isCapturing) {
          setIsCapturing(result.isCapturing)
          setStatus("Capturing audio")
        }
        if (result.effectParams) {
          setEffectParams(result.effectParams)
        }
      })
    }
  }, [])

  // Update effect parameters and send to offscreen document
  const updateEffectParam = async (param: keyof typeof effectParams, value: number) => {
    const newParams = { ...effectParams, [param]: value }
    setEffectParams(newParams)

    // Save to storage
    if (chrome?.storage?.local) {
      chrome.storage.local.set({ effectParams: newParams })
    }

    // Send to offscreen document if processing
    if (isCapturing) {
      try {
        await chrome.runtime.sendMessage({
          type: "UPDATE_EFFECT_PARAMS",
          params: { [param]: value }
        })
      } catch (error) {
        console.error("Error updating effect parameters:", error)
      }
    }
  }

  const handleCaptureTab = async () => {
    try {
      setIsCapturing(true)
      setStatus("Starting capture...")

      // Get the current active tab
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })

      if (!activeTab?.id) {
        throw new Error("No active tab found")
      }

      console.log("Capturing audio from tab:", activeTab.id)

      // Get media stream ID first (Chrome 116+ approach)
      const streamId = await (chrome.tabCapture as any).getMediaStreamId({
        targetTabId: activeTab.id
      })

      if (!streamId) {
        throw new Error("Failed to get media stream ID")
      }

      console.log("Media stream ID obtained:", streamId)

      // Tell background script to set up offscreen document
      await chrome.runtime.sendMessage({
        type: "SETUP_OFFSCREEN"
      })

      // Send stream ID to offscreen document for processing
      await chrome.runtime.sendMessage({
        type: "PROCESS_STREAM",
        streamId: streamId,
        tabId: activeTab.id
      })

      setStatus("Capturing audio (passthrough mode)")

      // Save capturing state
      if (chrome?.storage?.local) {
        chrome.storage.local.set({ isCapturing: true })
      }
    } catch (error) {
      console.error("Error capturing tab:", error)
      setStatus(`Error: ${error.message}`)
      setIsCapturing(false)
      if (chrome?.storage?.local) {
        chrome.storage.local.set({ isCapturing: false })
      }
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
        if (chrome?.storage?.local) {
        chrome.storage.local.set({ isCapturing: false })
      }
      } else {
        throw new Error(response.error)
      }
    } catch (error) {
      console.error("Error stopping capture:", error)
      setStatus(`Error: ${error.message}`)
    }
  }

  // Debug function to clear all streams
  const handleClearAllStreams = async () => {
    try {
      setStatus("Clearing all streams...")

      await chrome.runtime.sendMessage({
        type: "STOP_PROCESSING"
      })

      setStatus("Ready")
      setIsCapturing(false)
      if (chrome?.storage?.local) {
        chrome.storage.local.set({ isCapturing: false })
      }
    } catch (error) {
      console.error("Error clearing streams:", error)
      setStatus(`Error: ${error.message}`)
    }
  }

  return (
    <div
      style={{
        padding: 16,
        minWidth: 320,
        textAlign: "center"
      }}>
      <h3 style={{ margin: "0 0 16px 0" }}>Tab Bitcrusher</h3>

      <div style={{ marginBottom: 16 }}>
        Status: <span style={{ fontWeight: "bold" }}>{status}</span>
      </div>

      {/* Bitcrusher Controls */}
      <div style={{
        marginTop: 16,
        padding: "16px 12px",
        backgroundColor: "#f8f9fa",
        borderRadius: "8px",
        border: "1px solid #e9ecef"
      }}>
        <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "600" }}>
          Bitcrusher Controls
        </h4>

        {/* Bit Depth Control */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: "12px", fontWeight: "500", color: "#495057" }}>
            Bit Depth: {effectParams.bits}
          </label>
          <input
            type="range"
            min="1"
            max="16"
            step="1"
            value={effectParams.bits}
            onChange={(e) => updateEffectParam('bits', parseInt(e.target.value))}
            style={{
              width: "100%",
              marginTop: 4,
              accentColor: "#007bff"
            }}
            disabled={!isCapturing}
          />
        </div>

        {/* Sample Rate Reduction Control */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: "12px", fontWeight: "500", color: "#495057" }}>
            Sample Rate Reduction: {Math.round(effectParams.normalRange * 100)}%
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={effectParams.normalRange}
            onChange={(e) => updateEffectParam('normalRange', parseFloat(e.target.value))}
            style={{
              width: "100%",
              marginTop: 4,
              accentColor: "#28a745"
            }}
            disabled={!isCapturing}
          />
        </div>

        {/* Wet/Dry Mix Control */}
        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: "12px", fontWeight: "500", color: "#495057" }}>
            Wet/Dry Mix: {Math.round(effectParams.wet * 100)}%
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={effectParams.wet}
            onChange={(e) => updateEffectParam('wet', parseFloat(e.target.value))}
            style={{
              width: "100%",
              marginTop: 4,
              accentColor: "#ffc107"
            }}
            disabled={!isCapturing}
          />
        </div>

        <div style={{ fontSize: "11px", color: "#6c757d", fontStyle: "italic" }}>
          {!isCapturing
            ? "Controls will be active when audio capture is running"
            : "Adjust parameters in real-time"
          }
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: "12px", color: "#666" }}>
        {!isCapturing
          ? "Click to start processing audio from the current tab"
          : "Audio is being processed with bitcrusher effect"
        }
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
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

        {/* Debug Clear Button */}
        <button
          onClick={handleClearAllStreams}
          style={{
            padding: "6px 12px",
            backgroundColor: "#ffc107",
            color: "#000",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px"
          }}
        >
          🧹 Clear All Streams (Debug)
        </button>
      </div>
    </div>
  )
}

export default IndexPopup
