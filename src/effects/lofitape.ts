import type { EffectConfig } from './types'

export const lofiTapeConfig: EffectConfig = {
  id: 'lofitape',
  name: 'Lo-Fi Tape',
  description: 'Analog tape degradation with wow, flutter, saturation and hiss',
  parameters: [
    {
      key: 'wowDepth',
      label: 'Wow',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.3,
      unit: '%'
    },
    {
      key: 'flutterRate',
      label: 'Flutter',
      min: 0.1,
      max: 20,
      step: 0.1,
      default: 6.0,
      unit: 'Hz'
    },
    {
      key: 'saturation',
      label: 'Saturation',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.4,
      unit: '%'
    },
    {
      key: 'toneRolloff',
      label: 'Tone',
      min: 1000,
      max: 12000,
      step: 100,
      default: 6000,
      unit: 'Hz'
    },
    {
      key: 'noise',
      label: 'Noise',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.1,
      unit: '%'
    },
    {
      key: 'wet',
      label: 'Dry/Wet',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.8,
      unit: '%'
    }
  ],
  defaultValues: {
    wowDepth: 0.3,
    flutterRate: 6.0,
    saturation: 0.4,
    toneRolloff: 6000,
    noise: 0.1,
    wet: 0.8
  },
  sliderColor: '#D2691E'
}
