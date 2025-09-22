import { EffectConfig } from './types'

export const bitcrusherConfig: EffectConfig = {
  id: 'bitcrusher',
  name: 'Bitcrusher',
  description: 'Digital distortion with bit depth and sample rate reduction',
  parameters: [
    {
      key: 'bits',
      label: 'Bit Depth',
      min: 1,
      max: 16,
      step: 1,
      default: 8,
      unit: 'bits'
    },
    {
      key: 'normalRange',
      label: 'Sample Rate Reduction',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.4,
      unit: '%'
    },
    {
      key: 'wet',
      label: 'Wet/Dry Mix',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.5,
      unit: '%'
    }
  ],
  defaultValues: {
    bits: 8,
    normalRange: 0.4,
    wet: 0.5
  }
}