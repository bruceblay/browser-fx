import { getEffectConfig, getEffectDefaults } from './effects'

// A preset stores the sound, not the runtime instances. Slot ids are minted
// fresh on every load, so anything that needs to point at a slot points at its
// position in the chain instead.
export type PresetSlot = {
  effectId: string
  params: Record<string, number>
  enabled: boolean
}

// MIDI bindings travel with the preset by slot position. The live mapping
// format keys off slotId, which cannot survive a reload, so presets store the
// index and the loader rebinds onto the new instances.
export type PresetMidiBinding = {
  key: string // cc_<n> or note_<n>, matching the live mapping keys
  slotIndex: number
  kind: 'knob' | 'toggle'
  knobIndex?: number
}

export type Preset = {
  id: string
  name: string
  slots: PresetSlot[]
  midi: PresetMidiBinding[]
}

const PRESETS_KEY = 'userPresets'

export const isFactoryPreset = (id: string) => id.startsWith('factory_')

export const newPresetId = () =>
  'user_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)

// Factory params are deliberately partial. They merge over the effect's
// defaults at load time, so adding a parameter to an effect later doesn't
// leave old presets with a missing knob.
export const FACTORY_PRESETS: Preset[] = [
  {
    id: 'factory_lofi_radio',
    name: 'Lo-Fi Radio',
    midi: [],
    slots: [
      { effectId: 'simplefilter', enabled: true, params: { cutoffFreq: 1400, resonance: 8, filterType: 0, wet: 1 } },
      { effectId: 'lofitape', enabled: true, params: { wowDepth: 0.35, flutterRate: 7, saturation: 0.55, wet: 0.85 } }
    ]
  },
  {
    id: 'factory_chopped',
    name: 'Chopped & Screwed',
    midi: [],
    slots: [
      // A wide window keeps a shift this deep from sounding granular
      { effectId: 'pitchshifter', enabled: true, params: { pitch: -8, windowSize: 0.08, wet: 1 } },
      { effectId: 'loopchop', enabled: true, params: { loopSize: 3, stutterRate: 2, tempo: 70, wet: 0.6 } }
    ]
  },
  {
    id: 'factory_wobbler',
    name: 'Wobbler',
    midi: [],
    slots: [
      { effectId: 'vibrato', enabled: true, params: { rate: 5, depth: 0.6, type: 0, wet: 1 } },
      { effectId: 'autofilter', enabled: true, params: { rate: 2, baseFreq: 250, octaves: 3, wet: 0.6 } }
    ]
  },
  {
    id: 'factory_warped_record',
    name: 'Warped Record',
    midi: [],
    slots: [
      // Continuous mode keeps sagging and recovering instead of firing once
      { effectId: 'tapestop', enabled: true, params: { stopTime: 1.2, restartTime: 0.8, mode: 2, wet: 0.55 } },
      { effectId: 'lofitape', enabled: true, params: { wowDepth: 0.55, flutterRate: 2.5, saturation: 0.5, wet: 0.8 } }
    ]
  },
  {
    id: 'factory_jet_stream',
    name: 'Jet Stream',
    midi: [],
    slots: [
      { effectId: 'flanger', enabled: true, params: { rate: 0.3, depth: 90, feedback: 0.85, wet: 0.8 } },
      { effectId: 'phaser', enabled: true, params: { rate: 0.4, depth: 0.8, feedback: 0.5, wet: 0.5 } }
    ]
  },
  {
    id: 'factory_dub_echo',
    name: 'Dub Echo',
    midi: [],
    slots: [
      // Delay first so the slow filter sweep runs across the echo tails, which
      // is the part that reads as dub rather than as a plain echo
      { effectId: 'delay', enabled: true, params: { delayTime: 0.44, feedback: 0.72, wet: 0.5 } },
      { effectId: 'autofilter', enabled: true, params: { rate: 0.2, baseFreq: 200, octaves: 3.5, wet: 0.7 } }
    ]
  },
  {
    id: 'factory_mono',
    name: 'Mono',
    midi: [],
    slots: [
      // Width 0 collapses the stereo image to the mid channel. A single-slot
      // preset so it stays a listening setting rather than part of a sound.
      { effectId: 'utility', enabled: true, params: { gain: 0, pan: 0, width: 0, invert: 0 } }
    ]
  },
  {
    id: 'factory_robot',
    name: 'Cyborg',
    midi: [],
    slots: [
      { effectId: 'ringmodulator', enabled: true, params: { carrierFreq: 775, mix: 70, waveform: 0, wet: 0.75 } },
      { effectId: 'bitcrusher', enabled: true, params: { bits: 6, normalRange: 0.6, wet: 0.4 } }
    ]
  }
]

// Drops slots whose effect no longer exists, caps the chain, and fills any
// parameter the preset didn't specify from the effect's defaults.
export const normalizePresetSlots = (slots: any, maxChain: number): PresetSlot[] => {
  if (!Array.isArray(slots)) return []
  const valid = slots
    .filter((s: any) => s && typeof s.effectId === 'string' && getEffectConfig(s.effectId))
    .slice(0, maxChain)
    .map((s: any) => ({
      effectId: s.effectId,
      params: { ...getEffectDefaults(s.effectId), ...(s.params || {}) },
      enabled: s.enabled !== false
    }))
  // A lone slot has no bypass toggle in the UI, so never load one bypassed
  if (valid.length === 1) valid[0].enabled = true
  return valid
}

const normalizePreset = (p: any, maxChain: number): Preset | null => {
  if (!p || typeof p.id !== 'string' || typeof p.name !== 'string') return null
  const slots = normalizePresetSlots(p.slots, maxChain)
  if (!slots.length) return null
  const midi: PresetMidiBinding[] = Array.isArray(p.midi)
    ? p.midi.filter((b: any) =>
        b && typeof b.key === 'string' &&
        typeof b.slotIndex === 'number' && b.slotIndex < slots.length &&
        (b.kind === 'knob' || b.kind === 'toggle'))
    : []
  return { id: p.id, name: p.name, slots, midi }
}

export const loadUserPresets = async (maxChain: number): Promise<Preset[]> => {
  try {
    const result = await chrome.storage.local.get([PRESETS_KEY])
    const raw = result[PRESETS_KEY]
    if (!Array.isArray(raw)) return []
    return raw.map((p) => normalizePreset(p, maxChain)).filter(Boolean) as Preset[]
  } catch {
    return []
  }
}

export const saveUserPresets = async (presets: Preset[]): Promise<void> => {
  try {
    await chrome.storage.local.set({ [PRESETS_KEY]: presets })
  } catch (error) {
    console.error('Failed to save presets:', error)
  }
}

// "Bitcrusher + Hall Reverb". Descriptive without asking the user for anything.
export const deriveName = (slots: Array<{ effectId: string }>): string => {
  const names = slots
    .map((s) => getEffectConfig(s.effectId)?.name)
    .filter(Boolean) as string[]
  return names.length ? names.join(' + ') : 'New Preset'
}

// "Lo-Fi Radio" -> "Lo-Fi Radio 2" when the name is taken
export const uniqueName = (base: string, taken: string[]): string => {
  if (!taken.includes(base)) return base
  let n = 2
  while (taken.includes(`${base} ${n}`)) n++
  return `${base} ${n}`
}
