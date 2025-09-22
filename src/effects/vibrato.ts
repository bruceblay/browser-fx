import { EffectConfig } from './types'

export const vibratoConfig: EffectConfig = {
  id: 'vibrato',
  name: 'Vibrato',
  description: 'Pitch modulation effect using delay-based frequency modulation',
  parameters: [
    {
      key: 'frequency',
      label: 'Rate',
      min: 0.1,
      max: 20,
      step: 0.1,
      default: 5.0,
      unit: 'Hz'
    },
    {
      key: 'depth',
      label: 'Depth',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.3,
      unit: '%'
    },
    {
      key: 'type',
      label: 'LFO Type',
      min: 0,
      max: 3,
      step: 1,
      default: 0,
      unit: ''
    },
    {
      key: 'wet',
      label: 'Wet/Dry Mix',
      min: 0,
      max: 1,
      step: 0.01,
      default: 1.0,
      unit: '%'
    }
  ],
  defaultValues: {
    frequency: 5.0,
    depth: 0.3,
    type: 0,
    wet: 1.0
  }
}