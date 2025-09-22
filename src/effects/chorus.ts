import { EffectConfig } from './types'

export const chorusConfig: EffectConfig = {
  id: 'chorus',
  name: 'Chorus',
  description: 'Rich chorus effect with rate and depth control',
  parameters: [
    {
      key: 'rate',
      label: 'Rate',
      min: 0.1,
      max: 10,
      step: 0.1,
      default: 2.0,
      unit: 'Hz'
    },
    {
      key: 'depth',
      label: 'Depth',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.6,
      unit: '%'
    },
    {
      key: 'delay',
      label: 'Delay Time',
      min: 2,
      max: 20,
      step: 0.1,
      default: 5,
      unit: 'ms'
    },
    {
      key: 'wet',
      label: 'Wet/Dry Mix',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.7,
      unit: '%'
    }
  ],
  defaultValues: {
    rate: 2.0,
    depth: 0.6,
    delay: 5,
    wet: 0.7
  }
}