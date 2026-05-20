import type { EffectConfig } from './types'

export const sidechainPumpConfig: EffectConfig = {
  id: 'sidechainpump',
  name: 'Sidechain Pump',
  description: 'Envelope-following gain duck triggered by kick/low-end energy',
  parameters: [
    {
      key: 'filterFreq',
      label: 'Detection Freq',
      min: 40,
      max: 200,
      step: 5,
      default: 100,
      unit: 'Hz'
    },
    {
      key: 'sensitivity',
      label: 'Sensitivity',
      min: 0.01,
      max: 0.5,
      step: 0.01,
      default: 0.1,
      unit: ''
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
      key: 'attack',
      label: 'Attack',
      min: 0.001,
      max: 0.05,
      step: 0.001,
      default: 0.005,
      unit: 's'
    },
    {
      key: 'release',
      label: 'Release',
      min: 0.05,
      max: 0.8,
      step: 0.01,
      default: 0.25,
      unit: 's'
    },
    {
      key: 'wet',
      label: 'Dry/Wet',
      min: 0,
      max: 1,
      step: 0.01,
      default: 1.0,
      unit: '%'
    }
  ],
  defaultValues: {
    filterFreq: 100,
    sensitivity: 0.1,
    depth: 0.8,
    attack: 0.005,
    release: 0.25,
    wet: 1.0
  },
  sliderColor: '#FF1493'
}
