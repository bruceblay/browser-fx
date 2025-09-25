import { EffectConfig } from './types'

export const pingPongDelayConfig: EffectConfig = {
  id: 'pingpongdelay',
  name: 'Delay',
  description: 'Simple delay',
  parameters: [
    {
      key: 'delayTime',
      label: 'Delay Time',
      min: 0.01,
      max: 1.0,
      step: 0.01,
      default: 0.25,
      unit: 's'
    },
    {
      key: 'feedback',
      label: 'Feedback',
      min: 0,
      max: 0.95,
      step: 0.01,
      default: 0.3,
      unit: '%'
    },
    {
      key: 'stereoSpread',
      label: 'Stereo Spread',
      min: 0,
      max: 1,
      step: 0.01,
      default: 1.0,
      unit: '%'
    },
    {
      key: 'wet',
      label: 'Wet/Dry Mix',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.4,
      unit: '%'
    }
  ],
  defaultValues: {
    delayTime: 0.2,
    feedback: 0.5,
    stereoSpread: 1.0,
    wet: 0.7
  }
}