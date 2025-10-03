import type { EffectConfig } from './types'

export const compressorConfig: EffectConfig = {
  id: 'compressor',
  name: 'Compressor',
  description: 'Dynamic range compression for punch and consistency',
  parameters: [
    {
      key: 'threshold',
      label: 'Threshold',
      min: -60,
      max: 0,
      step: 1,
      default: -24,
      unit: 'dB'
    },
    {
      key: 'ratio',
      label: 'Ratio',
      min: 1,
      max: 20,
      step: 0.1,
      default: 4,
      unit: ':1'
    },
    {
      key: 'attack',
      label: 'Attack',
      min: 0,
      max: 1,
      step: 0.001,
      default: 0.003,
      unit: 's'
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
    threshold: -24,    // -24dB threshold
    ratio: 4,          // 4:1 ratio (musical compression)
    attack: 0.2,
    wet: 1.0           // 100% wet (full compression)
  },
  sliderColor: '#4169E1', // Royal blue
  xyMapping: {
    xParam: {
      parameterIndex: 0, // threshold parameter
      range: { min: -60, max: 0 } // Threshold range
    },
    yParam: {
      parameterIndex: 1, // ratio parameter
      range: { min: 1, max: 20 } // Ratio range
    }
  }
}