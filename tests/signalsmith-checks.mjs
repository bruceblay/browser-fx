import { createEngine } from './signalsmith-engine.mjs'

function frequency(samples, rate, start, end) {
  let first, last, crossings = 0
  for (let i = Math.ceil(start * rate) + 1; i < Math.floor(end * rate); i++) {
    if (samples[i - 1] <= 0 && samples[i] > 0) {
      const position = i - 1 - samples[i - 1] / (samples[i] - samples[i - 1])
      first ??= position
      last = position
      crossings++
    }
  }
  return crossings > 2 ? (crossings - 1) * rate / (last - first) : 0
}

function assert(condition, message) { if (!condition) throw new Error(message) }
const round = value => Math.round(value * 1000) / 1000

// Real Chrome rendering with the vendored WASM engine, rather than a mocked
// worklet. Known tones isolate routing and parameter behavior from tracking.
export async function runSignalChecks() {
  const results = []
  for (const [profile, rate] of [['quality', 48000], ['responsive', 48000], ['quality', 44100]]) {
    const context = new OfflineAudioContext(2, Math.ceil(5.2 * rate), rate)
    const { node, latency } = await createEngine(context, profile)
    assert(latency > 0 && latency < 0.3, `Unexpected latency: ${latency}`)
    const buffer = context.createBuffer(2, Math.ceil(4.5 * rate), rate)
    for (let c = 0; c < 2; c++) {
      const samples = buffer.getChannelData(c)
      const hz = [220, 330][c]
      for (let i = 0; i < samples.length; i++) samples[i] = 0.15 * Math.sin(2 * Math.PI * hz * i / rate)
    }
    const source = context.createBufferSource()
    source.buffer = buffer
    source.connect(node).connect(context.destination)
    const changes = [[1, -3], [2, 3], [3, -3], [3.25, 3], [3.5, -3], [3.75, 3], [4, 0]]
    const tasks = changes.map(([time, semitones]) => context.suspend(time).then(async () => {
      await node.schedule({ semitones, formantCompensation: false })
      await context.resume()
    }))
    await node.schedule({ semitones: 0, formantCompensation: false })
    source.start()
    let rendered
    try {
      rendered = await context.startRendering()
      await Promise.all(tasks)
    } finally { node.disconnect(); node.port.close() }
    const measurements = []
    let peak = 0
    for (let c = 0; c < 2; c++) {
      const samples = rendered.getChannelData(c)
      for (const sample of samples) {
        assert(Number.isFinite(sample), `${profile}: nonfinite output`)
        peak = Math.max(peak, Math.abs(sample))
      }
      for (const [start, end, semitones] of [[0.5, 0.9, 0], [1.5, 1.9, -3], [2.5, 2.9, 3]]) {
        const expected = [220, 330][c] * 2 ** (semitones / 12)
        const actual = frequency(samples, rate, start, end)
        const cents = 1200 * Math.log2(actual / expected)
        // Keep the original 5-cent accuracy requirement visible. Complete the
        // measurements even when it fails, so the other profile is comparable.
        assert(actual > 0 && Number.isFinite(cents), `${profile}: missing pitched output`)
        measurements.push({ channel: c, semitones, hz: round(actual), centsError: round(cents), withinFiveCents: Math.abs(cents) < 5 })
      }
      let residual = 0
      for (let i = Math.ceil(5 * rate); i < samples.length; i++) residual = Math.max(residual, Math.abs(samples[i]))
      assert(residual < 0.0001, `${profile}: output failed to return to silence (${residual})`)
    }
    assert(peak < 0.6, `${profile}: unexpectedly high output ${peak}`)
    // Report the final 60 ms of each 250 ms step. This is a response probe, not
    // a sound-quality score or proof that a pitch tracker would work.
    const rapidSteps = changes.filter(([time]) => time >= 3 && time < 4).map(([time, semitones]) => {
      const expected = 220 * 2 ** (semitones / 12)
      const hz = frequency(rendered.getChannelData(0), rate, time + 0.18, time + 0.24)
      return { semitones, hz: round(hz), centsError: round(1200 * Math.log2(hz / expected)) }
    })
    results.push({ profile, rate, latencyMs: round(latency * 1000), peak: round(peak), measurements, rapidSteps })
  }
  const accuracyPassed = results.every(result => result.measurements.every(value => value.withinFiveCents))
  return {
    status: accuracyPassed ? 'PASS: routing and fixed-pitch accuracy checks.' : 'FAIL: one or more fixed shifts exceed the 5-cent accuracy requirement. Do not promote this build to automatic correction.',
    routingPassed: true, accuracyPassed,
    note: 'Rapid steps are diagnostic only. These checks do not establish vocal sound quality.',
    results
  }
}
