import { useState } from "react"
import { Header } from "./components/Header"
import { EffectSelector } from "./components/EffectSelector"
import { EffectControls } from "./components/EffectControls"
import { ActionButtons } from "./components/ActionButtons"
import { AboutView } from "./components/AboutView"
import { getEffectConfig, getEffectDefaults } from "./effects"

function IndexPopup() {
  const [isCapturing, setIsCapturing] = useState(false)
  const [selectedEffect, setSelectedEffect] = useState("bitcrusher")
  const [effectParams, setEffectParams] = useState<Record<string, number>>(() =>
    getEffectDefaults("bitcrusher")
  )
  const [showAbout, setShowAbout] = useState(false)

  const currentEffectConfig = getEffectConfig(selectedEffect)

  const handleEffectChange = (effectId: string) => {
    setSelectedEffect(effectId)
    setEffectParams(getEffectDefaults(effectId))
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

  const handleStartCapture = () => {
    setIsCapturing(true)
    chrome.runtime.sendMessage({
      type: "START_CAPTURE",
      effectId: selectedEffect,
      params: effectParams
    }, (response) => {
      if (!response?.success) {
        console.error("Failed to start capture:", response?.error)
        setIsCapturing(false)
      }
    })
  }

  const handleStopCapture = () => {
    setIsCapturing(false)
    chrome.runtime.sendMessage({
      type: "STOP_CAPTURE"
    })
  }

  const handleClearStreams = () => {
    chrome.runtime.sendMessage({
      type: "CLEAR_ALL_STREAMS"
    })
  }

  if (showAbout) {
    return (
      <div style={{ width: 380, height: 600, padding: 0, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <AboutView onBack={() => setShowAbout(false)} />
      </div>
    )
  }

  return (
    <div style={{
      width: 380,
      height: 600,
      padding: 0,
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{ padding: '20px 24px' }}>
        <Header onInfoClick={() => setShowAbout(true)} />

        <div style={{ marginTop: 24 }}>
          <label style={{
            display: 'block',
            marginBottom: 8,
            fontSize: 14,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.9)'
          }}>
            Select Effect
          </label>
          <EffectSelector
            selectedEffect={selectedEffect}
            onEffectChange={handleEffectChange}
          />
        </div>

        <div style={{ marginTop: 24 }}>
          <EffectControls
            effectConfig={currentEffectConfig}
            effectParams={effectParams}
            isCapturing={isCapturing}
            onParamUpdate={handleParamUpdate}
          />
        </div>

        <div style={{ marginTop: 32 }}>
          <ActionButtons
            isCapturing={isCapturing}
            onCapture={handleStartCapture}
            onStop={handleStopCapture}
            onClearStreams={handleClearStreams}
          />
        </div>
      </div>
    </div>
  )
}

export default IndexPopup