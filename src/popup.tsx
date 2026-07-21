import { useState, useEffect, useRef } from "react"
import "./fonts.css"
import { Header } from "./components/Header"
import { EffectSelector } from "./components/EffectSelector"
import { EffectControls } from "./components/EffectControls"
import { Visualizer } from "./components/Visualizer"
import { AboutView } from "./components/AboutView"
import { getEffectConfig, getEffectDefaults } from "./effects"
import { theme } from "./theme"

type ChainSlot = {
  effectId: string
  params: Record<string, number>
}

const MAX_CHAIN = 4
// Knobs shrink as the chain grows to conserve vertical space
const KNOB_SIZES = [68, 56, 48, 44]
const POPUP_HEIGHTS = [260, 335, 435, 535]

const defaultSlot = (effectId: string): ChainSlot => ({
  effectId,
  params: getEffectDefaults(effectId)
})

function IndexPopup() {
  const [isCapturing, setIsCapturing] = useState(false)
  const [chain, setChain] = useState<ChainSlot[]>([defaultSlot("bitcrusher")])
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

  const single = chain.length === 1
  const knobSize = KNOB_SIZES[chain.length - 1]
  const popupHeight = POPUP_HEIGHTS[chain.length - 1]

  // Knob order and ranges for an effect, sent to the offscreen document so
  // MIDI CC values can be scaled onto the right parameters
  const paramSpecsFor = (effectId: string) =>
    getEffectConfig(effectId)?.parameters.map(p => ({
      key: p.key, min: p.min, max: p.max, step: p.step
    }))

  const chainWithSpecs = (c: ChainSlot[]) =>
    c.map(s => ({ effectId: s.effectId, params: s.params, paramSpecs: paramSpecsFor(s.effectId) }))

  const sendChain = (c: ChainSlot[]) => {
    chrome.runtime.sendMessage({ type: "SET_CHAIN", chain: chainWithSpecs(c) })
  }

  // Dynamically adjust popup height to the chain length
  useEffect(() => {
    const height = showAbout ? 600 : popupHeight

    // Reset height first to allow shrinking
    document.body.style.height = 'auto'
    document.body.style.minHeight = 'auto'

    requestAnimationFrame(() => {
      document.body.style.height = `${height}px`
      document.body.style.minHeight = `${height}px`
    })
  }, [popupHeight, showAbout])

  // Load saved state on component mount
  useEffect(() => {
    const loadSavedState = async () => {
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (activeTab.id) {
          setCurrentTabId(activeTab.id)

          const storageKey = `tabState_${activeTab.id}`
          const result = await chrome.storage.local.get([storageKey])
          const savedState = result[storageKey]

          if (savedState) {
            console.log("Loading saved state for tab", activeTab.id, savedState)

            if (Array.isArray(savedState.chain)) {
              // Drop slots whose effect no longer exists
              const valid = savedState.chain
                .filter((s: any) => s && getEffectConfig(s.effectId))
                .slice(0, MAX_CHAIN)
                .map((s: any) => ({
                  effectId: s.effectId,
                  params: s.params || getEffectDefaults(s.effectId)
                }))
              if (valid.length) setChain(valid)
            } else if (savedState.selectedEffect) {
              // Migrate the old single-effect state shape
              const effectExists = getEffectConfig(savedState.selectedEffect)
              const effectId = effectExists ? savedState.selectedEffect : "bitcrusher"
              setChain([{
                effectId,
                params: effectExists && savedState.effectParams
                  ? savedState.effectParams
                  : getEffectDefaults(effectId)
              }])
            }

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
          await chrome.storage.local.set({ [storageKey]: { chain, isCapturing } })
        } catch (error) {
          console.error("Failed to save state:", error)
        }
      }
    }

    saveState()
  }, [currentTabId, chain, isCapturing])

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

  const handleEffectChange = (slotIndex: number, effectId: string) => {
    const newChain = chain.map((s, i) => i === slotIndex ? defaultSlot(effectId) : s)
    setChain(newChain)
    if (isCapturing) sendChain(newChain)
  }

  const handleParamUpdate = (slotIndex: number, param: string, value: number) => {
    lastLocalEditRef.current = Date.now()
    setChain(prev => prev.map((s, i) =>
      i === slotIndex ? { ...s, params: { ...s.params, [param]: value } } : s
    ))

    if (isCapturing) {
      chrome.runtime.sendMessage({
        type: "UPDATE_EFFECT_PARAMS",
        slotIndex,
        effectId: chain[slotIndex]?.effectId,
        params: { [param]: value }
      })
    }
  }

  const handleAddSlot = () => {
    if (chain.length >= MAX_CHAIN) return
    const newChain = [...chain, defaultSlot("reverb")]
    setChain(newChain)
    if (isCapturing) sendChain(newChain)
  }

  const handleRemoveSlot = (slotIndex: number) => {
    if (chain.length <= 1) return
    const newChain = chain.filter((_, i) => i !== slotIndex)
    setChain(newChain)
    if (isCapturing) sendChain(newChain)
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
      chain: chainWithSpecs(chain)
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
  // CCs drive slot 1's knobs, including while the effect is off. Hardware
  // control is deliberately confined to the first effect in the chain so one
  // CC never fans out across every slot.
  const midiMappingsRef = useRef(midiMappings)
  midiMappingsRef.current = midiMappings
  const chainRef = useRef(chain)
  chainRef.current = chain
  const handleParamUpdateRef = useRef<(slotIndex: number, param: string, value: number) => void>(() => {})
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

      // Normal control: scale the CC onto the mapped knob of slot 1
      const knobIndex = midiMappingsRef.current[cc]
      if (knobIndex === undefined) return
      const slot0 = chainRef.current[0]
      const spec = slot0 && getEffectConfig(slot0.effectId)?.parameters[knobIndex]
      if (!spec) return
      let value = spec.min + (msg.data[2] / 127) * (spec.max - spec.min)
      if (spec.step) value = Math.round(value / spec.step) * spec.step
      value = Math.max(spec.min, Math.min(spec.max, value))
      handleParamUpdateRef.current(0, spec.key, value)
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
    frameChain: Array<{ effectId: string; params: Record<string, number> }> | null,
    midi: { status: string; lastEvent: string } | null
  ) => {
    if (midi) {
      setMidiStatus(midi.lastEvent ? `${midi.status} · ${midi.lastEvent}` : midi.status)
    }
    if (!frameChain || Date.now() - lastLocalEditRef.current < 400) return
    setChain(prev => {
      let changed = false
      const next = prev.map((slot, i) => {
        const incoming = frameChain[i]
        if (!incoming || incoming.effectId !== slot.effectId || !incoming.params) return slot
        for (const key of Object.keys(slot.params)) {
          if (incoming.params[key] !== undefined && Math.abs(incoming.params[key] - slot.params[key]) > 1e-9) {
            changed = true
            return { ...slot, params: { ...slot.params, ...incoming.params } }
          }
        }
        return slot
      })
      return changed ? next : prev
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
        <AboutView
          onBack={() => setShowAbout(false)}
          isCapturing={isCapturing}
          tabId={currentTabId}
        />
      </div>
    )
  }

  const hintRow = (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 20
    }}>
      {midiLearn ? (
        <span style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          fontSize: 10,
          textTransform: 'lowercase',
          letterSpacing: '0.3px',
          userSelect: 'none'
        }}>
          {midiStatus && (
            <span style={{ color: theme.textFaint, fontSize: 9 }}>
              midi: {midiStatus}
            </span>
          )}
          <button
            onClick={handleMidiReset}
            title="Clear all MIDI mappings and open the setup page"
            style={{
              background: 'none',
              border: 'none',
              padding: '2px 6px',
              fontFamily: 'inherit',
              fontSize: 9,
              color: theme.textFaint,
              textTransform: 'lowercase',
              letterSpacing: '0.3px',
              textDecoration: 'underline',
              cursor: 'pointer',
              userSelect: 'none'
            }}
            onMouseOver={(e) => { e.currentTarget.style.color = theme.textDim }}
            onMouseOut={(e) => { e.currentTarget.style.color = theme.textFaint }}
          >
            reset midi + open setup
          </button>
        </span>
      ) : !isCapturing && (
        <button
          onClick={handleStartCapture}
          title="Start audio capture"
          style={{
            background: 'none',
            border: 'none',
            padding: '4px 8px',
            fontFamily: 'inherit',
            fontSize: 10,
            color: startFailed ? '#e0796a' : theme.textFaint,
            textTransform: 'lowercase',
            letterSpacing: '0.3px',
            cursor: 'pointer',
            userSelect: 'none',
            transition: 'color 0.15s ease'
          }}
          onMouseOver={(e) => { e.currentTarget.style.color = startFailed ? '#eda093' : theme.textDim }}
          onMouseOut={(e) => { e.currentTarget.style.color = startFailed ? '#e0796a' : theme.textFaint }}
        >
          {startFailed
            ? <>capture failed, press <span style={{ color: theme.led, padding: '0 2px' }}>●</span> to retry</>
            : <>press <span style={{ color: theme.led, padding: '0 2px' }}>●</span> to start</>}
        </button>
      )}
    </div>
  )

  const learnTextRow = midiLearn && (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 16
    }}>
      <span style={{
        fontSize: 10,
        color: theme.led,
        textTransform: 'lowercase',
        letterSpacing: '0.3px',
        userSelect: 'none'
      }}>
        {midiLearnTarget === null
          ? 'click a knob, then move a control on your midi device'
          : 'now move a control on your midi device...'}
      </span>
    </div>
  )

  const addButton = chain.length < MAX_CHAIN && (
    <button
      onClick={handleAddSlot}
      title="Add another effect to the chain"
      style={{
        background: theme.control,
        border: '1px dashed #3f3f3f',
        borderRadius: 3,
        padding: '4px 16px',
        fontFamily: 'inherit',
        fontSize: 10,
        fontWeight: 600,
        color: theme.textDim,
        textTransform: 'lowercase',
        letterSpacing: '0.4px',
        cursor: 'pointer',
        userSelect: 'none',
        alignSelf: 'center',
        transition: 'color 0.15s ease, border-color 0.15s ease'
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.color = theme.text
        e.currentTarget.style.borderColor = '#555'
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.color = theme.textDim
        e.currentTarget.style.borderColor = '#3f3f3f'
      }}
    >
      <span style={{ color: theme.led, paddingRight: 4 }}>+</span>add effect
    </button>
  )

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
          accentColor={getEffectConfig(chain[0].effectId)?.sliderColor || theme.led}
          tabId={currentTabId}
          onFrame={handleVisualizerFrame}
        />

        <div style={{
          position: 'relative',
          zIndex: 1,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          gap: single ? 0 : 10
        }}>
          {chain.map((slot, i) => {
            const config = getEffectConfig(slot.effectId)
            const isFirst = i === 0

            const selectorRow = (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <EffectSelector
                    selectedEffect={slot.effectId}
                    onEffectChange={(id) => handleEffectChange(i, id)}
                  />
                </div>
                {chain.length > 1 && (
                  <button
                    onClick={() => handleRemoveSlot(i)}
                    title="Remove this effect from the chain"
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 3,
                      border: `1px solid ${theme.controlBorder}`,
                      background: theme.control,
                      color: theme.textFaint,
                      fontSize: 11,
                      lineHeight: 1,
                      cursor: 'pointer',
                      padding: 0,
                      flexShrink: 0,
                      transition: 'color 0.15s ease'
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.color = '#e0796a' }}
                    onMouseOut={(e) => { e.currentTarget.style.color = theme.textFaint }}
                  >
                    ×
                  </button>
                )}
              </div>
            )

            const knobs = (
              <EffectControls
                effectConfig={config}
                effectParams={slot.params}
                isCapturing={isCapturing}
                knobSize={knobSize}
                midiLearn={midiLearn && isFirst}
                midiLearnTarget={midiLearnTarget}
                midiMappings={midiMappings}
                onArmKnob={handleArmKnob}
                onParamUpdate={(param, value) => handleParamUpdate(i, param, value)}
              />
            )

            if (single) {
              // Single-effect layout matches the pre-chain look: knobs float
              // centered between the selector and the bottom hint
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  {selectorRow}
                  <div style={{
                    flex: midiLearn ? 1.2 : 0.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {learnTextRow}
                  </div>
                  {knobs}
                  <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6
                  }}>
                    {addButton}
                    {hintRow}
                  </div>
                </div>
              )
            }

            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {selectorRow}
                {isFirst && learnTextRow}
                {knobs}
              </div>
            )
          })}

          {!single && (
            <div style={{
              marginTop: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              paddingTop: 2
            }}>
              {addButton}
              {hintRow}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default IndexPopup
