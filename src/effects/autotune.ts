import type { EffectConfig } from './types'

export const autoTuneConfig: EffectConfig = {
  id: 'autotune',
  name: 'Auto Tune',
  description: 'Snap a solo voice to a musical scale. Retune 0 gives hard tuning; higher settings glide. Try a pentatonic scale for a stronger effect. Chromatic ignores Key.',
  parameters: [
    {
      key: 'key', label: 'Key', min: 0, max: 11, step: 1, default: 0,
      valueLabels: ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B']
    },
    {
      key: 'scale', label: 'Scale', min: 0, max: 4, step: 1, default: 1,
      valueLabels: ['Chrom.', 'Major', 'Minor', 'Maj. Pent.', 'Min. Pent.']
    },
    {
      key: 'retune', label: 'Retune', min: 0, max: 300, step: 5, default: 0, unit: 'ms'
    },
    {
      key: 'wet', label: 'Mix', min: 0, max: 1, step: 0.01, default: 1, unit: '%'
    }
  ],
  defaultValues: { key: 0, scale: 1, retune: 0, wet: 1 },
  sliderColor: '#C780E8'
}
