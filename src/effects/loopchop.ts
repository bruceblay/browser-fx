import type { EffectConfig } from './types'

export const loopChopConfig: EffectConfig = {
  id: 'loopchop',
  name: 'Loop Chop',
  description: 'Rhythmic audio capture and loop playback',
  parameters: [
    {
      key: 'loopSize',
      label: 'Loop Size',
      min: 0,
      max: 4,
      step: 1,
      default: 2,
      unit: '' // Will map to: 0=1/32, 1=1/16, 2=1/8, 3=1/4, 4=1/2 beat
    },
    {
      key: 'stutterRate',
      label: 'Repeat Rate',
      min: 1,
      max: 16,
      step: 1,
      default: 4,
      unit: 'x'
    },
    {
      key: 'triggerMode',
      label: 'Trigger Mode',
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      unit: '' // 0=continuous, 1=triggered
    },
    {
      key: 'wet',
      label: 'Wet/Dry Mix',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.8,
      unit: '%'
    }
  ],
  defaultValues: {
    loopSize: 2,        // 1/8 beat
    stutterRate: 4,     // 4x repeats
    triggerMode: 0,     // continuous
    wet: 0.8            // 80% wet
  },
  xyMapping: {
    xParam: {
      parameterIndex: 0, // loopSize parameter
      range: { min: 0, max: 4 } // Loop size range
    },
    yParam: {
      parameterIndex: 1, // stutterRate parameter
      range: { min: 1, max: 16 } // Stutter rate range
    }
  }
}