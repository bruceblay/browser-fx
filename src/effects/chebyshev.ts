import { EffectConfig } from './types'

export const chebyshevConfig: EffectConfig = {
  id: 'chebyshev',
  name: 'Chebyshev',
  description: 'Polynomial waveshaping distortion with harmonic generation',
  parameters: [
    {
      key: 'order',
      label: 'Order',
      min: 1,
      max: 50,
      step: 1,
      default: 5,
      unit: ''
    },
    {
      key: 'oversample',
      label: 'Oversample',
      min: 0,
      max: 2,
      step: 1,
      default: 1,
      unit: ''
    },
    {
      key: 'drive',
      label: 'Drive',
      min: 0,
      max: 10,
      step: 0.1,
      default: 1.0,
      unit: ''
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
    order: 5,
    oversample: 1,
    drive: 1.0,
    wet: 0.8
  }
}