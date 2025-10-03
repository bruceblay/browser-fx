import type { EffectConfig } from './types'

export const djEQConfig: EffectConfig = {
  id: 'djeq',
  name: 'DJ EQ',
  description: '3-band equalizer for quick tonal shaping',
  parameters: [
    {
      key: 'highGain',
      label: 'High Gain',
      min: -15,
      max: 15,
      step: 0.5,
      default: 0,
      unit: 'dB'
    },
    {
      key: 'midGain',
      label: 'Mid Gain',
      min: -15,
      max: 15,
      step: 0.5,
      default: 0,
      unit: 'dB'
    },
    {
      key: 'lowGain',
      label: 'Low Gain',
      min: -15,
      max: 15,
      step: 0.5,
      default: 0,
      unit: 'dB'
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
    highGain: 0,     // Neutral high frequencies (10kHz)
    lowGain: 0,      // Neutral low frequencies (100Hz)
    midGain: 0,      // Neutral mid frequencies (1kHz)
    wet: 1.0         // 100% wet (full EQ)
  },
  sliderColor: '#D4C5A9', // Boss GE-7 beige
  xyMapping: {
    xParam: {
      parameterIndex: 0, // highGain parameter
      range: { min: -15, max: 15 } // High frequency gain range
    },
    yParam: {
      parameterIndex: 1, // lowGain parameter
      range: { min: -15, max: 15 } // Low frequency gain range
    }
  }
}