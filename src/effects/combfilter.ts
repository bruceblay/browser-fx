import type { EffectConfig } from './types'

export const combFilterConfig: EffectConfig = {
  id: 'combfilter',
  name: 'Comb Filter',
  description: 'Metallic resonant comb filtering for texture effects',
  parameters: [
    {
      key: 'delayTime',
      label: 'Delay Time',
      min: 0.001,
      max: 0.05,
      step: 0.001,
      default: 0.01,
      unit: 's'
    },
    {
      key: 'feedback',
      label: 'Feedback',
      min: 0.70,
      max: 0.95,
      step: 0.05,
      default: 0.7,
      unit: '%'
    },
    {
      key: 'feedforward',
      label: 'Feedforward',
      min: 0,
      max: 1,
      step: 0.05,
      default: 0.5,
      unit: '%'
    },
    {
      key: 'wet',
      label: 'Wet/Dry Mix',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.6,
      unit: '%'
    }
  ],
  defaultValues: {
    delayTime: 0.01,     // 10ms delay (100Hz fundamental)
    feedback: 0.95,       // 95% feedback for resonance
    feedforward: 0.5,    // 50% feedforward
    wet: 0.9             // 90% wet
  }
}