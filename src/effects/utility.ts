import type { EffectConfig } from './types'

export const utilityConfig: EffectConfig = {
  id: 'utility',
  name: 'Utility',
  description: 'Gain, pan, and stereo width. Width at 0 sums to mono.',
  parameters: [
    {
      key: 'gain',
      label: 'Gain',
      min: -24,
      max: 12,
      step: 0.5,
      default: 0,
      unit: 'dB'
    },
    {
      key: 'pan',
      label: 'Pan',
      min: -1,
      max: 1,
      step: 0.02,
      default: 0,
      unit: 'pan'
    },
    {
      key: 'width',
      label: 'Width',
      min: 0,
      max: 2,
      step: 0.01,
      default: 1,
      unit: 'width' // 0 = mono, 1 = unchanged, 2 = double-wide
    }
    // A polarity flip on the right channel is implemented in createUtility but
    // deliberately not exposed: what it does is unclear without a mono sum to
    // hear it against, so it read as a knob that did nothing. Add it back here
    // to bring it out of hiding; the audio side already handles it.
  ],
  defaultValues: {
    gain: 0,      // unity
    pan: 0,       // center
    width: 1,     // untouched stereo image
    invert: 0     // polarity flip, unexposed (see above)
  },
  sliderColor: '#8FA3B8' // Steel grey: a utility, not a colour effect
}
