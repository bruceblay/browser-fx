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
  // Stable instance identity: midi mappings bind to this, so they follow the
  // slot through reorders and distinguish duplicate effects
  id: string
  effectId: string
  params: Record<string, number>
  enabled: boolean
}

type MidiBinding = { slotId: string; kind: 'knob' | 'toggle'; knobIndex?: number }

// Mapping keys namespace the message type: knobs bind to CCs, toggles can
// bind to a CC button or a pad note
const ccKey = (n: number) => `cc_${n}`
const noteKey = (n: number) => `note_${n}`

const newSlotId = () =>
  'slot_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

const MAX_CHAIN = 4
// Knobs shrink as the chain grows to conserve vertical space
const KNOB_SIZES = [68, 56, 48, 44]
const POPUP_HEIGHTS = [260, 330, 430, 515]

const defaultSlot = (effectId: string): ChainSlot => ({
  id: newSlotId(),
  effectId,
  params: getEffectDefaults(effectId),
  enabled: true
})

function IndexPopup() {
  const [isCapturing, setIsCapturing] = useState(false)
  const [chain, setChain] = useState<ChainSlot[]>([defaultSlot("bitcrusher")])
  const [showAbout, setShowAbout] = useState(false)
  const [currentTabId, setCurrentTabId] = useState<number | null>(null)
  const [startFailed, setStartFailed] = useState(false)
  const [midiLearn, setMidiLearn] = useState(false)
  // knob is a parameter index, or 'toggle' for the slot's bypass LED
  const [midiLearnTarget, setMidiLearnTarget] = useState<{ slot: number; knob: number | 'toggle' } | null>(null)
  const [midiMappings, setMidiMappings] = useState<Record<string, MidiBinding>>({})
  const [midiStatus, setMidiStatus] = useState('')
  const midiLearnTargetRef = useRef<{ slot: number; knob: number | 'toggle' } | null>(null)
  const midiAccessRef = useRef<MIDIAccess | null>(null)
  // Suppresses knob updates from offscreen frames right after a local drag,
  // so the UI doesn't fight the user's hand
  const lastLocalEditRef = useRef(0)

  const single = chain.length === 1
  const knobSize = KNOB_SIZES[chain.length - 1]
  // The footer hint only renders when idle or in learn mode; reclaim its
  // space while capturing so chains end snug against the bottom
  const showFooterHint = midiLearn || !isCapturing
  // The add button floats bottom-right and hides during learn mode
  const canAdd = chain.length < MAX_CHAIN && !midiLearn
  const popupHeight = POPUP_HEIGHTS[chain.length - 1] - (!single && !showFooterHint && !canAdd ? 22 : 0)

  // Knob order and ranges for an effect, sent to the offscreen document so
  // MIDI CC values can be scaled onto the right parameters
  const paramSpecsFor = (effectId: string) =>
    getEffectConfig(effectId)?.parameters.map(p => ({
      key: p.key, min: p.min, max: p.max, step: p.step
    }))

  const chainWithSpecs = (c: ChainSlot[]) =>
    c.map(s => ({ id: s.id, effectId: s.effectId, params: s.params, enabled: s.enabled, paramSpecs: paramSpecsFor(s.effectId) }))

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
                  id: s.id || newSlotId(),
                  effectId: s.effectId,
                  params: s.params || getEffectDefaults(s.effectId),
                  enabled: s.enabled !== false
                }))
              if (valid.length) setChain(valid)
            } else if (savedState.selectedEffect) {
              // Migrate the old single-effect state shape
              const effectExists = getEffectConfig(savedState.selectedEffect)
              const effectId = effectExists ? savedState.selectedEffect : "bitcrusher"
              setChain([{
                id: newSlotId(),
                effectId,
                params: effectExists && savedState.effectParams
                  ? savedState.effectParams
                  : getEffectDefaults(effectId),
                enabled: true
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
    // A new effect in a slot is a new instrument: fresh instance id, and any
    // bindings to the old instance are retired
    const oldId = chain[slotIndex]?.id
    const newChain = chain.map((s, i) => i === slotIndex ? defaultSlot(effectId) : s)
    setChain(newChain)
    if (oldId) purgeMappingsForSlot(oldId)
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
    const removedId = chain[slotIndex]?.id
    if (removedId) purgeMappingsForSlot(removedId)
    let newChain = chain.filter((_, i) => i !== slotIndex)
    // A lone slot has no toggle, so never leave it silently bypassed
    if (newChain.length === 1 && !newChain[0].enabled) {
      newChain = [{ ...newChain[0], enabled: true }]
    }
    setChain(newChain)
    if (isCapturing) sendChain(newChain)
  }

  const handleToggleSlot = (slotIndex: number) => {
    const enabled = !chain[slotIndex].enabled
    setChain(prev => prev.map((s, i) => i === slotIndex ? { ...s, enabled } : s))
    if (isCapturing) {
      chrome.runtime.sendMessage({ type: "SET_SLOT_ENABLED", slotIndex, enabled })
    }
  }

  // Drag-to-reorder: the handle drags its slot vertically; slots are uniform
  // height in chain mode, so the drop target falls out of the travel distance
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragDy, setDragDy] = useState(0)
  const dragInfo = useRef<{ from: number; startY: number; slotH: number } | null>(null)
  const slotRefs = useRef<Array<HTMLDivElement | null>>([])

  const dragTargetIndex = () => {
    const info = dragInfo.current
    if (!info) return null
    return Math.max(0, Math.min(chain.length - 1, info.from + Math.round(dragDy / info.slotH)))
  }

  const handleDragStart = (e: React.PointerEvent, index: number) => {
    const el = slotRefs.current[index]
    const slotH = el ? el.getBoundingClientRect().height + 10 : 100
    dragInfo.current = { from: index, startY: e.clientY, slotH }
    setDragFrom(index)
    setDragDy(0)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handleDragMove = (e: React.PointerEvent) => {
    if (!dragInfo.current) return
    setDragDy(e.clientY - dragInfo.current.startY)
  }

  const handleDragEnd = () => {
    const info = dragInfo.current
    if (!info) return
    const target = dragTargetIndex()
    dragInfo.current = null
    setDragFrom(null)
    setDragDy(0)
    if (target !== null && target !== info.from) {
      const newChain = [...chain]
      const [moved] = newChain.splice(info.from, 1)
      newChain.splice(target, 0, moved)
      setChain(newChain)
      if (isCapturing) sendChain(newChain)
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

  // Load saved MIDI mappings (CC number -> { slotId, knobIndex }). Entries in
  // the old positional format (plain numbers) are discarded; re-learn binds
  // them to a slot instance.
  useEffect(() => {
    chrome.storage.local.get(['midiMappings'])
      .then((result) => {
        const raw = result.midiMappings || {}
        const valid: Record<string, MidiBinding> = {}
        for (const [key, v] of Object.entries(raw)) {
          const b = v as any
          if (!b || typeof b !== 'object' || !b.slotId) continue
          if (/^\d+$/.test(key) && b.knobIndex !== undefined) {
            // migrate the pre-toggle format (plain cc number keys)
            valid[ccKey(Number(key))] = { slotId: b.slotId, kind: 'knob', knobIndex: b.knobIndex }
          } else if (b.kind === 'knob' || b.kind === 'toggle') {
            valid[key] = b as MidiBinding
          }
        }
        setMidiMappings(valid)
        if (JSON.stringify(valid) !== JSON.stringify(raw)) {
          chrome.storage.local.set({ midiMappings: valid })
        }
      })
      .catch(() => {})
  }, [])

  // Drop bindings for a slot instance that no longer exists
  const purgeMappingsForSlot = (slotId: string) => {
    setMidiMappings(prev => {
      const next: Record<string, MidiBinding> = {}
      let dropped = false
      for (const [cc, binding] of Object.entries(prev)) {
        if (binding.slotId === slotId) { dropped = true; continue }
        next[cc] = binding
      }
      if (dropped) chrome.storage.local.set({ midiMappings: next })
      return dropped ? next : prev
    })
  }

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

  const handleArmKnob = (slotIndex: number, knobIndex: number | 'toggle') => {
    const target = { slot: slotIndex, knob: knobIndex }
    setMidiLearnTarget(target)
    midiLearnTargetRef.current = target
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
  const handleToggleSlotRef = useRef<(slotIndex: number) => void>(() => {})
  handleToggleSlotRef.current = handleToggleSlot

  useEffect(() => {
    let cancelled = false
    let access: MIDIAccess | null = null

    const handler = (msg: MIDIMessageEvent) => {
      if (!msg.data) return
      const status = msg.data[0] & 0xf0
      const d1 = msg.data[1]
      const d2 = msg.data[2]
      const isCc = status === 0xb0
      const isNoteOn = status === 0x90 && d2 > 0
      if (!isCc && !isNoteOn) return

      const saveMappings = (next: Record<string, MidiBinding>) => {
        chrome.storage.local.set({ midiMappings: next })
        return next
      }

      // Learn mode with an armed target: bind this message to the instance.
      // Knobs need continuous CCs; toggles accept a CC button or a pad note.
      const target = midiLearnTargetRef.current
      if (target !== null) {
        const slot = chainRef.current[target.slot]
        if (!slot) return
        const isToggle = target.knob === 'toggle'
        if (!isToggle && !isCc) return
        if (isToggle && isCc && d2 < 64) return // bind on press, not release
        const key = isCc ? ccKey(d1) : noteKey(d1)
        const binding: MidiBinding = isToggle
          ? { slotId: slot.id, kind: 'toggle' }
          : { slotId: slot.id, kind: 'knob', knobIndex: target.knob as number }
        setMidiMappings(prev => {
          // Reassigning a control replaces its old binding entirely
          const next: Record<string, MidiBinding> = {}
          for (const [prevKey, b] of Object.entries(prev)) {
            if (b.slotId === binding.slotId && b.kind === binding.kind &&
                (binding.kind === 'toggle' || b.knobIndex === binding.knobIndex)) continue
            next[prevKey] = b
          }
          next[key] = binding
          return saveMappings(next)
        })
        midiLearnTargetRef.current = null
        setMidiLearnTarget(null)
        return
      }

      // Normal control: the binding names a slot instance; find where it
      // currently sits in the chain (it follows reorders)
      const key = isCc ? ccKey(d1) : noteKey(d1)
      const binding = midiMappingsRef.current[key]
      if (!binding) return
      const slotIndex = chainRef.current.findIndex(s => s.id === binding.slotId)
      if (slotIndex === -1) return

      if (binding.kind === 'toggle') {
        if (isCc && d2 < 64) return // trigger on press only
        handleToggleSlotRef.current(slotIndex)
        return
      }

      if (!isCc) return
      const slot = chainRef.current[slotIndex]
      const spec = getEffectConfig(slot.effectId)?.parameters[binding.knobIndex!]
      if (!spec) return
      let value = spec.min + (d2 / 127) * (spec.max - spec.min)
      if (spec.step) value = Math.round(value / spec.step) * spec.step
      value = Math.max(spec.min, Math.min(spec.max, value))
      handleParamUpdateRef.current(slotIndex, spec.key, value)
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
    frameChain: Array<{ effectId: string; params: Record<string, number>; enabled?: boolean }> | null,
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
        let updated = slot
        // Hardware pad toggles flip enabled in the engine; reflect it here
        if (incoming.enabled !== undefined && incoming.enabled !== slot.enabled) {
          changed = true
          updated = { ...updated, enabled: incoming.enabled }
        }
        for (const key of Object.keys(slot.params)) {
          if (incoming.params[key] !== undefined && Math.abs(incoming.params[key] - slot.params[key]) > 1e-9) {
            changed = true
            updated = { ...updated, params: { ...updated.params, ...incoming.params } }
            break
          }
        }
        return updated
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

  const addButton = canAdd && (
    <button
      onClick={handleAddSlot}
      title="Add another effect to the chain"
      style={{
        position: 'absolute',
        right: 0,
        bottom: 0,
        zIndex: 2,
        background: theme.control,
        border: '1px dashed #3f3f3f',
        borderRadius: 3,
        padding: '3px 10px',
        fontFamily: 'inherit',
        fontSize: 10,
        fontWeight: 600,
        color: theme.textDim,
        textTransform: 'lowercase',
        letterSpacing: '0.4px',
        cursor: 'pointer',
        userSelect: 'none',
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
          gap: single ? 0 : 14
        }}>
          {chain.map((slot, i) => {
            const config = getEffectConfig(slot.effectId)
            const dragging = dragFrom === i
            const dropTarget = dragFrom !== null && !dragging && dragTargetIndex() === i

            // Bindings for this slot instance, in the cc -> knob shape the
            // knob row renders as badges
            const slotCcMap: Record<string, number> = {}
            let toggleBadge: string | null = null
            for (const [key, b] of Object.entries(midiMappings)) {
              if (b.slotId !== slot.id) continue
              if (b.kind === 'knob' && key.startsWith('cc_')) {
                slotCcMap[key.slice(3)] = b.knobIndex!
              } else if (b.kind === 'toggle') {
                toggleBadge = key.startsWith('cc_') ? `cc ${key.slice(3)}` : `n ${key.slice(5)}`
              }
            }
            const toggleArmed = midiLearn && midiLearnTarget?.slot === i && midiLearnTarget.knob === 'toggle'

            const selectorRow = (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {chain.length > 1 && (
                  <span
                    onPointerDown={(e) => handleDragStart(e, i)}
                    onPointerMove={handleDragMove}
                    onPointerUp={handleDragEnd}
                    title="Drag to reorder"
                    style={{
                      color: theme.textFaint,
                      fontSize: 16,
                      lineHeight: 1,
                      cursor: dragging ? 'grabbing' : 'grab',
                      touchAction: 'none',
                      userSelect: 'none',
                      padding: '4px 2px',
                      flexShrink: 0
                    }}
                  >
                    ≡
                  </span>
                )}
                {chain.length > 1 && (
                  <button
                    onClick={() => midiLearn ? handleArmKnob(i, 'toggle') : handleToggleSlot(i)}
                    title={midiLearn
                      ? "Click, then press a pad or button on your MIDI device"
                      : slot.enabled ? "Bypass this effect" : "Enable this effect"}
                    style={{
                      width: 11,
                      height: 11,
                      borderRadius: '50%',
                      border: midiLearn
                        ? `1px ${toggleArmed ? 'solid' : 'dashed'} ${theme.led}`
                        : `1px solid ${theme.panelBorder}`,
                      background: slot.enabled ? theme.led : '#232323',
                      boxShadow: toggleArmed
                        ? `0 0 8px ${theme.ledGlow}`
                        : slot.enabled ? `0 0 4px ${theme.ledGlow}` : 'inset 0 1px 2px rgba(0,0,0,0.6)',
                      cursor: 'pointer',
                      padding: 0,
                      flexShrink: 0,
                      transition: 'background 0.15s ease, box-shadow 0.15s ease'
                    }}
                  />
                )}
                {chain.length > 1 && midiLearn && toggleBadge && (
                  <span style={{
                    fontSize: 8,
                    color: theme.led,
                    letterSpacing: '0.3px',
                    userSelect: 'none',
                    flexShrink: 0
                  }}>
                    {toggleBadge}
                  </span>
                )}
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
                      width: 24,
                      height: 24,
                      borderRadius: 3,
                      border: `1px solid ${theme.controlBorder}`,
                      background: theme.control,
                      color: theme.textFaint,
                      fontSize: 14,
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
              <div style={{
                opacity: slot.enabled ? 1 : 0.45,
                transition: 'opacity 0.15s ease'
              }}>
                <EffectControls
                  effectConfig={config}
                  effectParams={slot.params}
                  isCapturing={isCapturing}
                  knobSize={knobSize}
                  midiLearn={midiLearn}
                  midiLearnTarget={midiLearnTarget?.slot === i && typeof midiLearnTarget.knob === 'number' ? midiLearnTarget.knob : null}
                  midiMappings={slotCcMap}
                  onArmKnob={(knob) => handleArmKnob(i, knob)}
                  onParamUpdate={(param, value) => handleParamUpdate(i, param, value)}
                />
              </div>
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
                    {hintRow}
                  </div>
                </div>
              )
            }

            return (
              <div
                key={i}
                ref={(el) => { slotRefs.current[i] = el }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 5,
                  position: 'relative',
                  transform: dragging ? `translateY(${dragDy}px)` : 'none',
                  zIndex: dragging ? 5 : 1,
                  opacity: dragging ? 0.92 : 1,
                  boxShadow: dragging ? '0 4px 14px rgba(0,0,0,0.55)' : 'none',
                  background: dragging ? theme.panel : 'transparent',
                  // Green edge marks where the dragged slot will land
                  borderTop: dropTarget && dragDy < 0 ? `2px solid ${theme.led}` : '2px solid transparent',
                  borderBottom: dropTarget && dragDy > 0 ? `2px solid ${theme.led}` : '2px solid transparent'
                }}
              >
                {selectorRow}
                {knobs}
              </div>
            )
          })}

          {!single && showFooterHint && (
            <div style={{
              marginTop: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              paddingTop: 2
            }}>
              {midiLearn && learnTextRow}
              {hintRow}
            </div>
          )}

          {addButton}
        </div>
      </div>
    </div>
  )
}

export default IndexPopup
