import { EffectConfig } from './types'

export const reverbConfig: EffectConfig = {
  id: 'reverb',
  name: 'Reverb',
  description: 'Spatial reverb effect with room simulation',
  parameters: [
    {
      key: 'roomSize',
      label: 'Size',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.7,
      unit: '%'
    },
    {
      key: 'decay',
      label: 'Decay',
      min: 0.1,
      max: 10,
      step: 0.1,
      default: 2.0,
      unit: 's'
    },
    {
      key: 'wet',
      label: 'Dry/Wet',
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
  },
  sliderColor: '#4A90E2' // Boss RV-6 blue
}