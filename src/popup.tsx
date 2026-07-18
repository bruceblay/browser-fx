import { useState, useEffect, useRef } from "react"
import "./fonts.css"
import { Header } from "./components/Header"
import { EffectSelector } from "./components/EffectSelector"
import { EffectControls } from "./components/EffectControls"
import { Visualizer } from "./components/Visualizer"
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
  const [startFailed, setStartFailed] = useState(false)
  const [midiLearn, setMidiLearn] = useState(false)
  const [midiLearnTarget, setMidiLearnTarget] = useState<number | null>(null)
  const [midiMappings, setMidiMappings] = useState<Record<string, number>>({})
  const [midiStatus, setMidiStatus] = useState('')
  const midiLearnTargetRef = useRef<number | null>(null)
  const midiAccessRef = useRef<MIDIAccess | null>(null)
  // Suppresses knob updates from offscreen frames right after a local drag,
  // so the UI doesn't fight the user's hand
  const lastLocalEditRef = useRef(0)

  const currentEffectConfig = getEffectConfig(selectedEffect)

  // Knob order and ranges for the active effect, sent to the offscreen
  // document so MIDI CC values can be scaled onto the right parameters
  const paramSpecsFor = (effectId: string) =>
    getEffectConfig(effectId)?.parameters.map(p => ({
      key: p.key, min: p.min, max: p.max, step: p.step
    }))

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

            // Saved state can claim "capturing" after an extension reload
            // killed the offscreen document. Verify against reality so the
            // UI never shows a live state with nothing running behind it.
            if (savedState.isCapturing) {
              chrome.runtime.sendMessage({ type: "GET_TAB_STATUS", tabId: activeTab.id }, (response) => {
                const err = chrome.runtime.lastError
                if (err || !response?.capturing) {
                  console.log("Saved capture state was stale, resetting to off")
                  setIsCapturing(false)
                }
              })
            }
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
        params: newParams,
        paramSpecs: paramSpecsFor(effectId)
      })
    }
  }

  const handleParamUpdate = (param: string, value: number) => {
    lastLocalEditRef.current = Date.now()
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
    setStartFailed(false)
    setIsCapturing(true)

    // Set a timeout to handle message port issues
    const timeoutId = setTimeout(() => {
      console.warn("Start capture taking longer than expected, but continuing...")
    }, 2000)

    chrome.runtime.sendMessage({
      type: "START_CAPTURE",
      effectId: selectedEffect,
      params: effectParams,
      paramSpecs: paramSpecsFor(selectedEffect)
    }, (response) => {
      startPending.current = false
      clearTimeout(timeoutId)

      if (chrome.runtime.lastError) {
        const error = chrome.runtime.lastError.message
        console.error("Runtime error:", error)

        // Only revert state for genuine errors, not timeouts
        if (!error.includes("message port closed")) {
          setIsCapturing(false)
          setStartFailed(true)
        } else {
          console.log("Message port timeout, but capture may still be working")
        }
        return
      }

      if (!response?.success) {
        console.error("Failed to start capture:", response?.error)
        setIsCapturing(false)
        setStartFailed(true)
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
    setStartFailed(false)
    chrome.runtime.sendMessage({
      type: "CLEAR_ALL_STREAMS"
    })
  }

  // Load saved MIDI mappings (CC number -> knob index)
  useEffect(() => {
    chrome.storage.local.get(['midiMappings'])
      .then((result) => setMidiMappings(result.midiMappings || {}))
      .catch(() => {})
  }, [])

  const handleMidiClick = async () => {
    if (midiLearn) {
      setMidiLearn(false)
      setMidiLearnTarget(null)
      midiLearnTargetRef.current = null
      return
    }
    // Learn mode needs MIDI permission; the grant has to happen on a real
    // page because permission prompts don't display from a toolbar popup
    try {
      const perm = await navigator.permissions.query({ name: 'midi' as PermissionName })
      if (perm.state !== 'granted') {
        chrome.tabs.create({ url: chrome.runtime.getURL('midi-setup.html') })
        return
      }
    } catch {
      chrome.tabs.create({ url: chrome.runtime.getURL('midi-setup.html') })
      return
    }
    setMidiLearn(true)
  }

  const handleArmKnob = (index: number) => {
    setMidiLearnTarget(index)
    midiLearnTargetRef.current = index
  }

  // Wipe all mappings and reopen the setup page for a clean slate
  const handleMidiReset = () => {
    setMidiMappings({})
    chrome.storage.local.set({ midiMappings: {} })
    setMidiLearnTarget(null)
    midiLearnTargetRef.current = null
    chrome.tabs.create({ url: chrome.runtime.getURL('midi-setup.html') })
  }

  // MIDI listening for the whole popup lifetime (when permission is granted).
  // An armed learn target consumes the next CC as a binding; otherwise mapped
  // CCs drive the knobs directly, including while the effect is off, so
  // values can be dialed in before engaging. The handler reads refs so it
  // never goes stale as state changes.
  const midiMappingsRef = useRef(midiMappings)
  midiMappingsRef.current = midiMappings
  const effectConfigRef = useRef(currentEffectConfig)
  effectConfigRef.current = currentEffectConfig
  const handleParamUpdateRef = useRef<(param: string, value: number) => void>(() => {})
  handleParamUpdateRef.current = handleParamUpdate

  useEffect(() => {
    let cancelled = false
    let access: MIDIAccess | null = null

    const handler = (msg: MIDIMessageEvent) => {
      if (!msg.data || (msg.data[0] & 0xf0) !== 0xb0) return
      const cc = msg.data[1]

      // Learn mode with an armed knob: bind and consume this CC
      const target = midiLearnTargetRef.current
      if (target !== null) {
        setMidiMappings(prev => {
          // Reassigning a knob replaces its old CC binding entirely
          const next: Record<string, number> = {}
          for (const [prevCc, knob] of Object.entries(prev)) {
            if (knob !== target) next[prevCc] = knob
          }
          next[cc] = target
          chrome.storage.local.set({ midiMappings: next })
          return next
        })
        midiLearnTargetRef.current = null
        setMidiLearnTarget(null)
        return
      }

      // Normal control: scale the CC onto the mapped knob of the active effect
      const knobIndex = midiMappingsRef.current[cc]
      if (knobIndex === undefined) return
      const spec = effectConfigRef.current?.parameters[knobIndex]
      if (!spec) return
      let value = spec.min + (msg.data[2] / 127) * (spec.max - spec.min)
      if (spec.step) value = Math.round(value / spec.step) * spec.step
      value = Math.max(spec.min, Math.min(spec.max, value))
      handleParamUpdateRef.current(spec.key, value)
    }

    const attach = (a: MIDIAccess) => {
      a.inputs.forEach((input) => { input.onmidimessage = handler })
    }

    const init = async () => {
      try {
        const perm = await navigator.permissions.query({ name: 'midi' as PermissionName })
        if (perm.state !== 'granted' || cancelled) return
        const a = await navigator.requestMIDIAccess({ sysex: false })
        if (cancelled) return
        access = a
        midiAccessRef.current = a
        attach(a)
        a.onstatechange = () => attach(a)
      } catch {
        // No MIDI available; learn mode's M button routes to the setup page
      }
    }
    init()

    return () => {
      cancelled = true
      if (access) {
        access.inputs.forEach((input) => { input.onmidimessage = null })
        access.onstatechange = null
      }
    }
  }, [])

  // Mirror parameter changes made by MIDI hardware (reported on visualizer
  // frames) onto the knobs, unless the user just moved one locally
  const handleVisualizerFrame = (
    effectId: string | null,
    params: Record<string, number> | null,
    midi: { status: string; lastEvent: string } | null
  ) => {
    if (midi) {
      setMidiStatus(midi.lastEvent ? `${midi.status} · ${midi.lastEvent}` : midi.status)
    }
    if (!params || effectId !== selectedEffect) return
    if (Date.now() - lastLocalEditRef.current < 400) return
    setEffectParams(prev => {
      let changed = false
      for (const key of Object.keys(prev)) {
        if (params[key] !== undefined && Math.abs(params[key] - prev[key]) > 1e-9) {
          changed = true
          break
        }
      }
      return changed ? { ...prev, ...params } : prev
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
        onMidiClick={handleMidiClick}
        midiLearnActive={midiLearn}
        isCapturing={isCapturing}
        onPowerToggle={isCapturing ? handleStopCapture : handleStartCapture}
      />

      <div style={{
        flex: 1,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        position: 'relative'
      }}>
        <Visualizer
          isCapturing={isCapturing}
          accentColor={currentEffectConfig?.sliderColor || theme.led}
          tabId={currentTabId}
          onFrame={handleVisualizerFrame}
        />

        <div style={{
          position: 'relative',
          zIndex: 1,
          flex: 1,
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
              startFailed={startFailed}
              midiLearn={midiLearn}
              midiLearnTarget={midiLearnTarget}
              midiMappings={midiMappings}
              midiStatus={midiStatus}
              onArmKnob={handleArmKnob}
              onMidiReset={handleMidiReset}
              onParamUpdate={handleParamUpdate}
              onStart={handleStartCapture}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default IndexPopup