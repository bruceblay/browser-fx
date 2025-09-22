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

// Registry of all available effects (NOTE: NOT using autoWah - using tremolo, pingpongdelay, vibrato, autofilter)
export const EFFECTS: Record<string, EffectConfig> = {
  [bitcrusherConfig.id]: bitcrusherConfig,
  [reverbConfig.id]: reverbConfig,
  [distortionConfig.id]: distortionConfig,
  [chorusConfig.id]: chorusConfig,
  [phaserConfig.id]: phaserConfig,
  [tremoloConfig.id]: tremoloConfig,
  [pingPongDelayConfig.id]: pingPongDelayConfig,
  [vibratoConfig.id]: vibratoConfig,
  [autoFilterConfig.id]: autoFilterConfig,
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
export { bitcrusherConfig, reverbConfig, distortionConfig, chorusConfig, phaserConfig, tremoloConfig, pingPongDelayConfig, vibratoConfig, autoFilterConfig }