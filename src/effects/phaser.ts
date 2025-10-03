import { EffectConfig } from './types'

export const phaserConfig: EffectConfig = {
  id: 'phaser',
  name: 'Phaser',
  description: 'Classic phaser effect with sweeping filters',
  parameters: [
    {
      key: 'rate',
      label: 'Rate',
      min: 0.1,
      max: 5,
      step: 0.1,
      default: 1.0,
      unit: 'Hz'
    },
    {
      key: 'depth',
      label: 'Depth',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.7,
      unit: '%'
    },
    {
      key: 'feedback',
      label: 'Feedback',
      min: 0,
      max: 0.9,
      step: 0.01,
      default: 0.3,
      unit: '%'
    },
    {
      key: 'wet',
      label: 'Dry/Wet',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.5,
      unit: '%'
    }
  ],
  defaultValues: {
    rate: 1.0,
    depth: 0.4,
    feedback: 0.7,
    wet: 1.0
  },
  sliderColor: '#32CD32' // Lime green
}