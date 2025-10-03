import { EffectConfig } from './types'

export const distortionConfig: EffectConfig = {
  id: 'distortion',
  name: 'Distortion',
  description: 'Overdrive and distortion with tone shaping',
  parameters: [
    {
      key: 'amount',
      label: 'Amount',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.5,
      unit: '%'
    },
    {
      key: 'tone',
      label: 'Tone',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.5,
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
    amount: 0.5,
    tone: 0.5,
    wet: 0.5
  },
  sliderColor: '#FF8C42' // Boss DS-1 orange
}