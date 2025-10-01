import { EffectConfig } from './types'
import { bitcrusherConfig } from './bitcrusher'
import { reverbConfig } from './reverb'
import { distortionConfig } from './distortion'
import { chorusConfig } from './chorus'
import { phaserConfig } from './phaser'
import { tremoloConfig } from './tremolo'
import { pingPongDelayConfig } from './pingpongdelay'
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
  [reverbConfig.id]: reverbConfig,
  [hallReverbConfig.id]: hallReverbConfig,
  [distortionConfig.id]: distortionConfig,
  [chorusConfig.id]: chorusConfig,
  [phaserConfig.id]: phaserConfig,
  [tremoloConfig.id]: tremoloConfig,
  [autoPannerConfig.id]: autoPannerConfig,
  [pingPongDelayConfig.id]: pingPongDelayConfig,
  [vibratoConfig.id]: vibratoConfig,
  [autoFilterConfig.id]: autoFilterConfig,
  [pitchShifterConfig.id]: pitchShifterConfig,
  [combFilterConfig.id]: combFilterConfig,
  [compressorConfig.id]: compressorConfig,
  [djEQConfig.id]: djEQConfig,
  [flangerConfig.id]: flangerConfig,
  [loopChopConfig.id]: loopChopConfig,
  [ringModulatorConfig.id]: ringModulatorConfig,
  [simpleFilterConfig.id]: simpleFilterConfig,
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
  reverbConfig,
  hallReverbConfig,
  distortionConfig,
  chorusConfig,
  phaserConfig,
  tremoloConfig,
  autoPannerConfig,
  pingPongDelayConfig,
  vibratoConfig,
  autoFilterConfig,
  pitchShifterConfig,
  combFilterConfig,
  compressorConfig,
  djEQConfig,
  flangerConfig,
  loopChopConfig,
  ringModulatorConfig,
  simpleFilterConfig,
  tapTempoDelayConfig
}