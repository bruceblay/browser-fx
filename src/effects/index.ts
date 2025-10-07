import { EffectConfig } from './types'
import { bitcrusherConfig } from './bitcrusher'
import { reverbConfig } from './reverb'
import { distortionConfig } from './distortion'
import { chorusConfig } from './chorus'
import { phaserConfig } from './phaser'
import { tremoloConfig } from './tremolo'
import { delayConfig } from './delay'
import { vibratoConfig } from './vibrato'
import { autoFilterConfig } from './autofilter'
import { pitchShifterConfig } from './pitchshifter'
import { autoPannerConfig } from './autopanner'
import { hallReverbConfig } from './hallreverb'
import { combFilterConfig } from './combfilter'
import { compressorConfig } from './compressor'
import { djEQConfig } from './djeq'
import { flangerConfig } from './flanger'
import { loopChopConfig } from './loopchop'
import { ringModulatorConfig } from './ringmodulator'
import { simpleFilterConfig } from './simplefilter'
import { tapTempoDelayConfig } from './taptempodelay'

// Registry of all available effects
export const EFFECTS: Record<string, EffectConfig> = {
  [bitcrusherConfig.id]: bitcrusherConfig,
  [loopChopConfig.id]: loopChopConfig,
  [reverbConfig.id]: reverbConfig,
  [simpleFilterConfig.id]: simpleFilterConfig,
  [vibratoConfig.id]: vibratoConfig,
  [combFilterConfig.id]: combFilterConfig,
  [delayConfig.id]: delayConfig,
  [djEQConfig.id]: djEQConfig,
  [autoPannerConfig.id]: autoPannerConfig,
  [hallReverbConfig.id]: hallReverbConfig,
  [distortionConfig.id]: distortionConfig,
  [chorusConfig.id]: chorusConfig,
  [phaserConfig.id]: phaserConfig,
  [tremoloConfig.id]: tremoloConfig,
  [autoFilterConfig.id]: autoFilterConfig,
  [pitchShifterConfig.id]: pitchShifterConfig,
  [compressorConfig.id]: compressorConfig,
  [flangerConfig.id]: flangerConfig,
  [ringModulatorConfig.id]: ringModulatorConfig,
  [tapTempoDelayConfig.id]: tapTempoDelayConfig,
}

// Get list of effects for dropdown
export const getEffectsList = (): { id: string; name: string }[] => {
  return Object.values(EFFECTS).map(effect => ({
    id: effect.id,
    name: effect.name
  }))
}

// Get effect configuration by ID
export const getEffectConfig = (effectId: string): EffectConfig | null => {
  return EFFECTS[effectId] || null
}

// Get default parameters for an effect
export const getEffectDefaults = (effectId: string): Record<string, number> => {
  const effect = getEffectConfig(effectId)
  return effect ? effect.defaultValues : {}
}

// Export all types and configs
export * from './types'
export {
  bitcrusherConfig,
  loopChopConfig,
  reverbConfig,
  simpleFilterConfig,
  vibratoConfig,
  combFilterConfig,
  delayConfig,
  djEQConfig,
  autoPannerConfig,
  hallReverbConfig,
  distortionConfig,
  chorusConfig,
  phaserConfig,
  tremoloConfig,
  autoFilterConfig,
  pitchShifterConfig,
  compressorConfig,
  flangerConfig,
  ringModulatorConfig,
  tapTempoDelayConfig
}