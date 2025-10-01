import type { EffectConfig } from './types'

export const simpleFilterConfig: EffectConfig = {
  id: 'simplefilter',
  name: 'Filter',
  description: 'Low-pass filter with cutoff frequency and resonance control',
  parameters: [
    {
      key: 'cutoffFreq',
      label: 'Cutoff Frequency',
      min: 100,
      max: 8000,
      step: 50,
      default: 2000,
      unit: 'Hz'
    },
    {
      key: 'resonance',
      label: 'Resonance',
      min: 0,
      max: 30,
      step: 0.5,
      default: 5,
      unit: 'dB'
    },
    {
      key: 'filterType',
      label: 'Filter Type',
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      unit: '' // 0=lowpass, 1=highpass, 2=bandpass
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
    cutoffFreq: 2000,    // 2kHz cutoff
    resonance: 5,        // 5dB resonance
    filterType: 0,       // lowpass
    wet: 1.0             // 100% wet (full filtering)
  },
  xyMapping: {
    xParam: {
      parameterIndex: 0, // cutoffFreq parameter
      range: { min: 100, max: 8000 } // Full frequency range
    },
    yParam: {
      parameterIndex: 1, // resonance parameter
      range: { min: 0, max: 30 } // Resonance range
    }
  }
}