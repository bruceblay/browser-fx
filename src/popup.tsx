import { useState, useEffect, useRef } from "react"
import "./fonts.css"
import { Header } from "./components/Header"
import { EffectSelector } from "./components/EffectSelector"
import { EffectControls } from "./components/EffectControls"
import { AboutView } from "./components/AboutView"
import { getEffectConfig, getEffectDefaults } from "./effects"
import { theme } from "./theme"

function IndexPopup() {
  const [isCapturing, setIsCapturing] = useState(false)
  const [selectedEffect, setSelectedEffect] = useState("bitcrusher")
  const [effectParams, setEffectParams] = useState<Record<string, number>>(() =>
    getEffectDefaults("bitcrusher")
  )
  const [showAbout, setShowAbout] = useState(false)
  const [currentTabId, setCurrentTabId] = useState<number | null>(null)

  const currentEffectConfig = getEffectConfig(selectedEffect)

  // Dynamically adjust popup height based on number of knob rows
  useEffect(() => {
    const paramCount = currentEffectConfig?.parameters?.length || 0
    // Up to 4 knobs fit in a single row; two rows need the taller popup
    const height = showAbout ? 600 : paramCount <= 4 ? 260 : 360

    // Reset height first to allow shrinking
    document.body.style.height = 'auto'
    document.body.style.minHeight = 'auto'

    // Then set the new height
    requestAnimationFrame(() => {
      document.body.style.height = `${height}px`
      document.body.style.minHeight = `${height}px`
    })
  }, [currentEffectConfig, showAbout])

  // Load saved state on component mount
  useEffect(() => {
    const loadSavedState = async () => {
      try {
        // Get current tab ID
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (activeTab.id) {
          setCurrentTabId(activeTab.id)

          // Load saved state for this tab
          const storageKey = `tabState_${activeTab.id}`
          const result = await chrome.storage.local.get([storageKey])
          const savedState = result[storageKey]

          if (savedState) {
            console.log("Loading saved state for tab", activeTab.id, savedState)
            // Fall back to the default effect if the saved one no longer exists
            const savedEffect = savedState.selectedEffect
            const effectExists = savedEffect && getEffectConfig(savedEffect)
            const effectId = effectExists ? savedEffect : "bitcrusher"
            setSelectedEffect(effectId)
            setEffectParams(
              effectExists && savedState.effectParams
                ? savedState.effectParams
                : getEffectDefaults(effectId)
            )
            setIsCapturing(savedState.isCapturing || false)
          }
        }
      } catch (error) {
        console.error("Failed to load saved state:", error)
      }
    }

    loadSavedState()
  }, [])

  // Save state whenever it changes
  useEffect(() => {
    const saveState = async () => {
      if (currentTabId) {
        try {
          const storageKey = `tabState_${currentTabId}`
          const stateToSave = {
            selectedEffect,
            effectParams,
            isCapturing
          }
          await chrome.storage.local.set({ [storageKey]: stateToSave })
          console.log("Saved state for tab", currentTabId, stateToSave)
        } catch (error) {
          console.error("Failed to save state:", error)
        }
      }
    }

    saveState()
  }, [currentTabId, selectedEffect, effectParams, isCapturing])

  // Remove body margin and set background behind the device panel
  useEffect(() => {
    document.body.style.margin = '0'
    document.body.style.padding = '0'
    document.body.style.background = theme.panel
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.margin = ''
      document.body.style.padding = ''
      document.body.style.background = ''
      document.body.style.overflow = ''
    }
  }, [])

  const handleEffectChange = (effectId: string) => {
    setSelectedEffect(effectId)
    const newParams = getEffectDefaults(effectId)
    setEffectParams(newParams)

    // If currently capturing, switch the effect in the offscreen document
    if (isCapturing) {
      chrome.runtime.sendMessage({
        type: "SWITCH_EFFECT",
        effectId: effectId,
        params: newParams
      })
    }
  }

  const handleParamUpdate = (param: string, value: number) => {
    setEffectParams(prev => ({ ...prev, [param]: value }))

    if (isCapturing) {
      chrome.runtime.sendMessage({
        type: "UPDATE_EFFECT_PARAMS",
        effectId: selectedEffect,
        params: { [param]: value }
      })
    }
  }

  // Blocks stop/start toggling while a START_CAPTURE is still in flight.
  // Without this, a double-click on the power LED fires start then stop, and
  // the short stop path can outrun the long start path: STOP_STREAM reaches
  // the offscreen document before PROCESS_STREAM, so audio ends up running
  // while the UI shows the off state.
  const startPending = useRef(false)

  const handleStartCapture = () => {
    if (startPending.current) return
    startPending.current = true
    setIsCapturing(true)

    // Set a timeout to handle message port issues
    const timeoutId = setTimeout(() => {
      console.warn("Start capture taking longer than expected, but continuing...")
    }, 2000)

    chrome.runtime.sendMessage({
      type: "START_CAPTURE",
      effectId: selectedEffect,
      params: effectParams
    }, (response) => {
      startPending.current = false
      clearTimeout(timeoutId)

      if (chrome.runtime.lastError) {
        const error = chrome.runtime.lastError.message
        console.error("Runtime error:", error)

        // Only revert state for genuine errors, not timeouts
        if (!error.includes("message port closed")) {
          setIsCapturing(false)
        } else {
          console.log("Message port timeout, but capture may still be working")
        }
        return
      }

      if (!response?.success) {
        console.error("Failed to start capture:", response?.error)
        setIsCapturing(false)
      } else {
        console.log("Capture started successfully")
      }
    })
  }

  const handleStopCapture = () => {
    if (startPending.current) return
    setIsCapturing(false)
    chrome.runtime.sendMessage({
      type: "STOP_CAPTURE"
    })
  }

  const handleClearStreams = () => {
    setIsCapturing(false)
    chrome.runtime.sendMessage({
      type: "CLEAR_ALL_STREAMS"
    })
  }

  if (showAbout) {
    return (
      <div style={{
        width: 380,
        height: 600,
        background: theme.panel,
        fontFamily: theme.font
      }}>
        <AboutView onBack={() => setShowAbout(false)} />
      </div>
    )
  }

  const paramCount = currentEffectConfig?.parameters?.length || 0
  const popupHeight = paramCount <= 4 ? 260 : 360

  return (
    <div style={{
      width: 380,
      height: popupHeight,
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      background: theme.panel,
      fontFamily: theme.font,
      color: theme.text
    }}>
      <Header
        onInfoClick={() => setShowAbout(true)}
        onClearClick={handleClearStreams}
        isCapturing={isCapturing}
        onPowerToggle={isCapturing ? handleStopCapture : handleStartCapture}
      />

      <div style={{
        flex: 1,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0
      }}>
        <EffectSelector
          selectedEffect={selectedEffect}
          onEffectChange={handleEffectChange}
        />

        <div style={{
          flex: 1,
          display: 'flex',
          minHeight: 0,
          padding: '8px 0'
        }}>
          <EffectControls
            effectConfig={currentEffectConfig}
            effectParams={effectParams}
            isCapturing={isCapturing}
            onParamUpdate={handleParamUpdate}
            onStart={handleStartCapture}
          />
        </div>
      </div>
    </div>
  )
}

export default IndexPopup