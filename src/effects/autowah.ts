import { EffectConfig } from './types'

export const autoWahConfig: EffectConfig = {
  id: 'autowah',
  name: 'Auto Wah',
  description: 'Envelope-following wah effect that responds to input level (experimental)',
  parameters: [
    {
      key: 'sensitivity',
      label: 'Sensitivity',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.5,
      unit: '%'
    },
    {
      key: 'baseFreq',
      label: 'Base Frequency',
      min: 200,
      max: 1500,
      step: 10,
      default: 400,
      unit: 'Hz'
    },
    {
      key: 'range',
      label: 'Frequency Range',
      min: 500,
      max: 4000,
      step: 50,
      default: 2000,
      unit: 'Hz'
    },
    {
      key: 'wet',
      label: 'Wet/Dry Mix',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.7,
      unit: '%'
    }
  ],
  defaultValues: {
    sensitivity: 0.5,
    baseFreq: 400,
    range: 2000,
    wet: 0.7
  }
}