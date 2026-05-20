import type { EffectConfig } from './types'

export const tapeStopConfig: EffectConfig = {
  id: 'tapestop',
  name: 'Tape Stop',
  description: 'Simulates turntable power-down with pitch ramp to silence',
  parameters: [
    {
      key: 'stopTime',
      label: 'Stop Time',
      min: 0.1,
      max: 3.0,
      step: 0.1,
      default: 1.0,
      unit: 's'
    },
    {
      key: 'restartTime',
      label: 'Restart Time',
      min: 0.1,
      max: 3.0,
      step: 0.1,
      default: 0.5,
      unit: 's'
    },
    {
      key: 'mode',
      label: 'Mode',
      min: 0,
      max: 2,
      step: 1,
      default: 2,
      unit: '' // 0=stop only, 1=stop+restart, 2=continuous
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
    stopTime: 1.0,
    restartTime: 0.5,
    mode: 2,
    wet: 1.0
  },
  sliderColor: '#2F4F4F'
}
