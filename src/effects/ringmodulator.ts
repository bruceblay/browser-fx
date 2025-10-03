import type { EffectConfig } from './types'

export const ringModulatorConfig: EffectConfig = {
  id: 'ringmodulator',
  name: 'Ring Mod',
  description: 'Metallic and robotic ring modulation effects',
  parameters: [
    {
      key: 'carrierFreq',
      label: 'Carrier Freq',
      min: 10,
      max: 2000,
      step: 10,
      default: 200,
      unit: 'Hz'
    },
    {
      key: 'mix',
      label: 'Mix',
      min: 0,
      max: 100,
      step: 1,
      default: 50,
      unit: '%'
    },
    {
      key: 'waveform',
      label: 'Carrier Wave',
      min: 0,
      max: 3,
      step: 1,
      default: 0,
      unit: '' // 0=sine, 1=square, 2=sawtooth, 3=triangle
    },
    {
      key: 'wet',
      label: 'Dry/Wet',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.7,
      unit: '%'
    }
  ],
  defaultValues: {
    carrierFreq: 200,  // 200Hz carrier
    mix: 50,           // 50% mix between original and modulated
    waveform: 0,       // sine wave carrier
    wet: 0.7           // 70% wet
  },
  sliderColor: '#DDA0DD', // Light purple (plum)
  xyMapping: {
    xParam: {
      parameterIndex: 0, // carrierFreq parameter
      range: { min: 10, max: 2000 } // Full frequency range
    },
    yParam: {
      parameterIndex: 1, // mix parameter
      range: { min: 0, max: 100 } // Mix range
    }
  }
}