import { EffectConfig } from './types'

export const hallReverbConfig: EffectConfig = {
  id: 'hallreverb',
  name: 'Hall Reverb',
  description: 'Large concert hall reverb with pre-delay and damping',
  parameters: [
    {
      key: 'roomSize',
      label: 'Size',
      min: 0.1,
      max: 1,
      step: 0.01,
      default: 0.8,
      unit: ''
    },
    {
      key: 'decay',
      label: 'Decay',
      min: 0.5,
      max: 10,
      step: 0.1,
      default: 4.0,
      unit: 's'
    },
    {
      key: 'preDelay',
      label: 'Pre-delay',
      min: 0,
      max: 0.2,
      step: 0.01,
      default: 0.03,
      unit: 's'
    },
    {
      key: 'damping',
      label: 'High Cut',
      min: 1000,
      max: 10000,
      step: 100,
      default: 6000,
      unit: 'Hz'
    },
    {
      key: 'wet',
      label: 'Dry/Wet',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.4,
      unit: '%'
    }
  ],
  defaultValues: {
    roomSize: 0.8,   // Large hall
    decay: 4.0,      // 4 second decay
    preDelay: 0.03,  // 30ms pre-delay
    damping: 6000,   // 6kHz high cut
    wet: 0.4         // 40% wet
  },
  sliderColor: '#6495ED' // Boss RV-6 cornflower blue
}