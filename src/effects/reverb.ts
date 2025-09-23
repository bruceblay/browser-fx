import { EffectConfig } from './types'

export const reverbConfig: EffectConfig = {
  id: 'reverb',
  name: 'Reverb',
  description: 'Spatial reverb effect with room simulation',
  parameters: [
    {
      key: 'roomSize',
      label: 'Room Size',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.7,
      unit: '%'
    },
    {
      key: 'decay',
      label: 'Decay Time',
      min: 0.1,
      max: 10,
      step: 0.1,
      default: 2.0,
      unit: 's'
    },
    {
      key: 'wet',
      label: 'Wet/Dry Mix',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.3,
      unit: '%'
    }
  ],
  defaultValues: {
    roomSize: 0.7,
    decay: 2.0,
    wet: 0.5
  }
}