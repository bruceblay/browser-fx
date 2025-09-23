import { EffectConfig } from './types'

export const autoFilterConfig: EffectConfig = {
  id: 'autofilter',
  name: 'Auto Filter',
  description: 'LFO-controlled filter with automatic cutoff frequency modulation',
  parameters: [
    {
      key: 'rate',
      label: 'Rate',
      min: 0.1,
      max: 10,
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
      default: 0.8,
      unit: '%'
    },
    {
      key: 'baseFreq',
      label: 'Base Frequency',
      min: 100,
      max: 2000,
      step: 10,
      default: 200,
      unit: 'Hz'
    },
    {
      key: 'octaves',
      label: 'Octaves',
      min: 1,
      max: 6,
      step: 0.5,
      default: 3.0,
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
    rate: 1.0,
    depth: 0.8,
    baseFreq: 200,
    octaves: 3.0,
    wet: 1.0
  }
}