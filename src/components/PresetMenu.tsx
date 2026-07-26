import { useState, useRef, useEffect } from "react"
import { theme } from "../theme"
import { isFactoryPreset, type Preset } from "../presets"

interface PresetMenuProps {
  userPresets: Preset[]
  factoryPresets: Preset[]
  activeId: string | null
  dirty: boolean
  suggestedName: string
  maxHeight: number
  onLoad: (preset: Preset) => void
  onSaveNew: (name: string) => void
  onUpdate: () => void
  onReset: () => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onClose: () => void
}

type Editing = { mode: 'new' | 'rename'; id?: string }

const rowBase: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  height: 24,
  padding: '0 10px',
  fontSize: 11,
  fontFamily: 'inherit',
  textAlign: 'left',
  background: 'transparent',
  border: 'none',
  width: '100%',
  boxSizing: 'border-box',
  cursor: 'pointer',
  userSelect: 'none'
}

const sectionLabel: React.CSSProperties = {
  padding: '6px 10px 3px',
  fontSize: 9,
  fontWeight: 600,
  letterSpacing: '0.7px',
  textTransform: 'uppercase',
  color: theme.textFaint,
  userSelect: 'none'
}

const divider: React.CSSProperties = {
  borderTop: '1px solid rgba(255,255,255,0.07)'
}

// Small ghost button used for the per-row actions and the delete confirm
const microButton = (color: string): React.CSSProperties => ({
  background: 'none',
  border: 'none',
  padding: '0 3px',
  fontFamily: 'inherit',
  fontSize: 10,
  lineHeight: 1,
  color,
  cursor: 'pointer'
})

export function PresetMenu({
  userPresets, factoryPresets, activeId, dirty, suggestedName, maxHeight,
  onLoad, onSaveNew, onUpdate, onReset, onRename, onDelete, onClose
}: PresetMenuProps) {
  const [editing, setEditing] = useState<Editing | null>(null)
  const [draft, setDraft] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // Enter commits and then blurs, and Escape cancels and then blurs. Without
  // this latch the trailing blur would save a second copy.
  const settledRef = useRef(false)

  // Save and rename share one input, so focus follows whichever opened it
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing?.mode, editing?.id])

  const activePreset = [...factoryPresets, ...userPresets].find(p => p.id === activeId)
  const activeIsUser = activePreset && !isFactoryPreset(activePreset.id)

  const startNew = () => {
    setConfirmId(null)
    setDraft(suggestedName)
    settledRef.current = false
    setEditing({ mode: 'new' })
  }

  const startRename = (p: Preset) => {
    setConfirmId(null)
    setDraft(p.name)
    settledRef.current = false
    setEditing({ mode: 'rename', id: p.id })
  }

  const settle = (save: boolean) => {
    if (settledRef.current) return
    settledRef.current = true
    const name = draft.trim()
    if (save && editing && name) {
      if (editing.mode === 'new') onSaveNew(name)
      else if (editing.id) onRename(editing.id, name)
    }
    setEditing(null)
  }

  const nameInput = (
    <div style={{ ...rowBase, cursor: 'default' }}>
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') settle(true)
          if (e.key === 'Escape') settle(false)
        }}
        onBlur={() => settle(true)}
        maxLength={40}
        style={{
          flex: 1,
          minWidth: 0,
          background: '#151515',
          border: `1px solid ${theme.led}`,
          borderRadius: 2,
          padding: '2px 5px',
          fontFamily: 'inherit',
          fontSize: 11,
          color: theme.textBright,
          outline: 'none'
        }}
      />
    </div>
  )

  const presetRow = (p: Preset) => {
    const factory = isFactoryPreset(p.id)
    const isActive = p.id === activeId
    const hovered = hoverId === p.id

    if (editing?.mode === 'rename' && editing.id === p.id) return <div key={p.id}>{nameInput}</div>

    if (confirmId === p.id) {
      return (
        <div key={p.id} style={{ ...rowBase, cursor: 'default', background: 'rgba(224,121,106,0.12)' }}>
          <span style={{ flex: 1, minWidth: 0, color: theme.textDim, fontSize: 10 }}>
            delete "{p.name}"?
          </span>
          <button onClick={() => { onDelete(p.id); setConfirmId(null) }} style={microButton('#e0796a')}>yes</button>
          <button onClick={() => setConfirmId(null)} style={microButton(theme.textFaint)}>no</button>
        </div>
      )
    }

    return (
      <div
        key={p.id}
        onMouseEnter={() => setHoverId(p.id)}
        onMouseLeave={() => setHoverId(null)}
        style={{ ...rowBase, background: hovered ? 'rgba(255,255,255,0.06)' : 'transparent' }}
        onClick={() => onLoad(p)}
        title={`Load ${p.name}`}
      >
        <span style={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          color: isActive ? theme.led : theme.text
        }}>
          {p.name}
        </span>
        {!factory && hovered && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); startRename(p) }}
              title="Rename"
              style={microButton(theme.textFaint)}
            >
              ✎
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmId(p.id) }}
              title="Delete"
              style={microButton(theme.textFaint)}
            >
              ×
            </button>
          </>
        )}
      </div>
    )
  }

  return (
    <>
      {/* Click-catcher: anywhere outside the panel dismisses it */}
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, zIndex: 9 }} />

      <div style={{
        position: 'absolute',
        top: 30,
        left: 8,
        right: 8,
        zIndex: 10,
        maxHeight,
        display: 'flex',
        flexDirection: 'column',
        background: theme.control,
        border: `1px solid ${theme.controlBorder}`,
        borderRadius: 3,
        boxShadow: '0 6px 18px rgba(0,0,0,0.6)',
        overflow: 'hidden'
      }}>
        {/* Save never overwrites. Update is the only path that replaces a
            preset, and it only exists for user presets you've modified. */}
        {editing?.mode === 'new' ? nameInput : (
          <div
            onClick={startNew}
            style={{ ...rowBase, color: theme.textDim }}
            onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'transparent' }}
            title="Save the current chain as a new preset"
          >
            <span style={{ color: theme.led }}>+</span>save as new
          </div>
        )}

        {/* The only way back to the one-slot bitcrusher the popup opens with */}
        <div
          onClick={onReset}
          style={{ ...rowBase, color: theme.textDim }}
          onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
          onMouseOut={(e) => { e.currentTarget.style.background = 'transparent' }}
          title="Clear the chain back to a single bitcrusher"
        >
          <span style={{ color: theme.led }}>⟲</span>start from scratch
        </div>

        {activeIsUser && dirty && (
          <div
            onClick={onUpdate}
            style={{ ...rowBase, color: theme.textDim }}
            onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'transparent' }}
            title={`Overwrite ${activePreset!.name} with the current chain`}
          >
            <span style={{ color: theme.led }}>↻</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              update "{activePreset!.name}"
            </span>
          </div>
        )}

        <div style={{ ...divider, overflowY: 'auto', minHeight: 0 }}>
          <div style={sectionLabel}>Factory</div>
          {factoryPresets.map(presetRow)}

          <div style={{ ...sectionLabel, ...divider, marginTop: 4, paddingTop: 6 }}>User</div>
          {userPresets.length === 0 ? (
            <div style={{ ...rowBase, cursor: 'default', color: theme.textFaint, fontSize: 10 }}>
              nothing saved yet
            </div>
          ) : userPresets.map(presetRow)}
        </div>
      </div>
    </>
  )
}
