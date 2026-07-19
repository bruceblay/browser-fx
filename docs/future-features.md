# Future Feature Ideas

Notes for possible future work, roughly sketched with implementation thoughts
based on the current architecture.

## Automation recording (knob loops)

Record knob movements (mouse or MIDI) and play them back as a loop, so a
filter sweep or wet/dry ride keeps going hands-free.

- Capture: record `(timestamp, paramKey, value)` tuples during a recording
  window. Both UI drags and MIDI already funnel through
  `updateEffectParamsForTab`, so the offscreen document is the natural tap
  point, and it keeps looping with the popup closed.
- Playback: a timer in the offscreen document replaying the tuples through the
  existing smoothed param path, wrapping at the loop boundary. Loop length
  could be fixed (bar-length at a tap tempo) or defined by the recording.
- UI sketch: a record button per effect (or per knob), a loop indicator on
  knobs with active automation, and a clear gesture. Knobs should visually
  follow playback via the existing frame mirroring.
- Open questions: quantize loop length to a tempo? Per-tab or per-effect
  storage? What happens when the user grabs a knob mid-loop (override then
  resume, or stop the loop)?

## Effect stacking (chain slots)

Around 4 slots so users can combine effects (filter into delay into reverb)
or double the same effect for extreme settings.

- Engine: the per-tab graph is already `source -> effect -> destination bus`;
  stacking means chaining `effect1.output -> effect2.input -> ...`. Each
  effect instance already has isolated params except the legacy shared
  `liveParams` object, which would need to become per-slot (the tab-scoped
  effects already take a `tabLiveParams` argument, so the remaining
  global-writing creators would need the same treatment).
- Wet/dry per slot already exists inside each effect, which handles most
  blend questions for free.
- UI sketch: slot strip (4 small boxes) under the selector; tapping a slot
  shows its effect's knobs. Could keep the current single-effect view as
  slot 1 so the simple flow stays simple.
- MIDI: positional mapping would need a slot dimension, or simply map to the
  currently viewed slot's knobs.
- Watch out for: CPU with multiple ScriptProcessor effects stacked,
  crossfade complexity when swapping one slot mid-chain, and per-tab state
  shape changes (migration for saved states).
