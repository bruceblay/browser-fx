import { EffectConfig } from './types'

export const tremoloConfig: EffectConfig = {
  id: 'tremolo',
  name: 'Tremolo',
  description: 'Classic amplitude modulation effect with rate and depth control',
  parameters: [
    {
      key: 'rate',
      label: 'Rate',
      min: 0.1,
      max: 20,
      step: 0.1,
      default: 6.0,
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
      key: 'spread',
      label: 'Stereo Spread',
      min: 0,
      max: 180,
      step: 5,
      default: 40,
      unit: '°'
    },
    {
      key: 'wet',
      label: 'Wet/Dry Mix',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.8,
      unit: '%'
    }
  ],
  defaultValues: {
    rate: 6.0,
    depth: 0.9,
    spread: 40,
    wet: 0.9
  },
  sliderColor: '#2C5F2D' // Boss TR-2 dark forest green
}