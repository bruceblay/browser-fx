import type { EffectConfig } from './types'

export const tapTempoDelayConfig: EffectConfig = {
  id: 'taptempodelay',
  name: 'Tap Delay',
  description: 'Beat-synced delay with tap tempo and subdivision control',
  parameters: [
    {
      key: 'subdivision',
      label: 'Subdivision',
      min: 0,
      max: 4,
      step: 1,
      default: 1,
      unit: '' // Will map to: 0=1/4, 1=1/8, 2=1/16, 3=dotted, 4=triplet
    },
    {
      key: 'feedback',
      label: 'Feedback',
      min: 0,
      max: 0.95,
      step: 0.01,
      default: 0.4,
      unit: '%'
    },
    {
      key: 'tapTempo',
      label: 'Tempo',
      min: 60,
      max: 200,
      step: 1,
      default: 120,
      unit: 'bpm'
    },
    {
      key: 'wet',
      label: 'Dry/Wet',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.5,
      unit: '%'
    }
  ],
  defaultValues: {
    subdivision: 1,    // 1/8 note
    feedback: 0.4,     // 40% feedback
    tapTempo: 120,     // 120 BPM
    wet: 0.5           // 50% wet
  },
  sliderColor: '#3CB371', // Medium sea green (Boss DD-6)
  xyMapping: {
    xParam: {
      parameterIndex: 0, // subdivision parameter
      range: { min: 0, max: 4 } // 5 subdivision types
    },
    yParam: {
      parameterIndex: 1, // feedback parameter
      range: { min: 0, max: 0.95 } // Feedback range
    }
  }
}