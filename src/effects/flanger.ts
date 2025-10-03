import type { EffectConfig } from './types'

export const flangerConfig: EffectConfig = {
  id: 'flanger',
  name: 'Flanger',
  description: 'Classic jet-plane whoosh flanging effect',
  parameters: [
    {
      key: 'rate',
      label: 'Rate',
      min: 0.1,
      max: 5.0,
      step: 0.1,
      default: 0.5,
      unit: 'Hz'
    },
    {
      key: 'depth',
      label: 'Depth',
      min: 0,
      max: 100,
      step: 1,
      default: 50,
      unit: '%'
    },
    {
      key: 'feedback',
      label: 'Feedback',
      min: 0,
      max: 0.95,
      step: 0.05,
      default: 0.3,
      unit: '%'
    },
    {
      key: 'wet',
      label: 'Wet/Dry Mix',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.5,
      unit: '%'
    }
  ],
  defaultValues: {
    rate: 0.5,       // 0.5Hz modulation rate
    depth: 50,       // 50% depth
    feedback: 0.3,   // 30% feedback
    wet: 0.5         // 50% wet
  },
  sliderColor: '#9370DB', // Boss BF-2 purple
  xyMapping: {
    xParam: {
      parameterIndex: 0, // rate parameter
      range: { min: 0.1, max: 5.0 } // Rate range
    },
    yParam: {
      parameterIndex: 1, // depth parameter
      range: { min: 0, max: 100 } // Depth range
    }
  }
}