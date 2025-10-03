import { EffectConfig } from './types'

export const pitchShifterConfig: EffectConfig = {
  id: 'pitchshifter',
  name: 'Pitch Shifter',
  description: 'Real-time pitch shifting without changing playback speed',
  parameters: [
    {
      key: 'pitch',
      label: 'Pitch',
      min: -12,
      max: 12,
      step: 0.1,
      default: 0,
      unit: 'semitones'
    },
    {
      key: 'windowSize',
      label: 'Window Size',
      min: 0.01,
      max: 0.1,
      step: 0.01,
      default: 0.05,
      unit: 's'
    },
    {
      key: 'overlap',
      label: 'Overlap',
      min: 0.1,
      max: 0.9,
      step: 0.1,
      default: 0.5,
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
    pitch: 2.0,      // +2 semitones up
    windowSize: 0.05, // 50ms window
    overlap: 0.5,     // 50% overlap
    wet: 1.0          // 100% wet
  },
  sliderColor: '#00CED1' // Boss PS-6 turquoise
}