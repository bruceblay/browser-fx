import { EffectConfig } from './types'

export const autoPannerConfig: EffectConfig = {
  id: 'autopanner',
  name: 'Auto Panner',
  description: 'Automatic left-right panning with LFO modulation',
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
    rate: 2.0,   // 2Hz panning
    depth: 0.8,  // 80% depth
    type: 0,     // Sine wave
    wet: 1.0     // 100% wet
  }
}