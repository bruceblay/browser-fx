import SignalsmithStretch from './vendor/signalsmith-stretch/SignalsmithStretch.mjs'

// Load the packaged module directly. The upstream Blob loader isn't needed,
// and this works with script-src 'self' 'wasm-unsafe-eval'.
const moduleURL = new URL('./vendor/signalsmith-stretch/SignalsmithStretch.mjs', import.meta.url).href
SignalsmithStretch.moduleUrl = moduleURL

export const profiles = {
  quality: { blockMs: 120, intervalMs: 30, splitComputation: true },
  responsive: { blockMs: 60, intervalMs: 10, splitComputation: true }
}

export async function createEngine(context, profile = 'quality') {
  if (!profiles[profile]) throw new Error(`Unknown profile: ${profile}`)
  await context.audioWorklet.addModule(moduleURL)
  const node = await SignalsmithStretch(context, {
    numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2],
    channelCount: 2, channelCountMode: 'explicit'
  })
  await node.configure(profiles[profile])
  const latency = await node.latency()
  // Disable the optional nonlinear frequency map: exact musical intervals
  // matter for correction. Formant compensation remains independently testable.
  await node.start({ active: true, semitones: 0, tonalityHz: 0, formantCompensation: true })
  return { node, latency }
}

export async function createComparison(context, profile) {
  const { node, latency } = await createEngine(context, profile)
  const input = context.createGain()
  const original = context.createDelay(1)
  original.delayTime.value = latency
  const dry = context.createGain()
  const wet = context.createGain()
  const output = context.createGain()
  // Equal gain in both paths. Leave headroom, without compressing away artifacts.
  output.gain.value = 0.7
  dry.gain.value = 1
  wet.gain.value = 0
  input.connect(original).connect(dry).connect(output)
  input.connect(node).connect(wet).connect(output)
  let disposed = false
  return {
    input, output, node, latency,
    async setPitch(semitones, formantCompensation) {
      if (disposed) return
      await node.schedule({ semitones, formantCompensation })
    },
    selectOriginal(originalOnly) {
      const now = context.currentTime
      for (const [param, target] of [[dry.gain, Number(originalOnly)], [wet.gain, Number(!originalOnly)]]) {
        param.cancelAndHoldAtTime(now)
        param.linearRampToValueAtTime(target, now + 0.02)
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      for (const n of [input, original, dry, node, wet, output]) n.disconnect()
      node.port.close()
    }
  }
}
