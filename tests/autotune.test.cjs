const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const { test } = require('node:test')
const source = fs.readFileSync(path.join(__dirname, '../autotune-worklet.js'), 'utf8')

async function processorFor(rate) {
  let Processor
  new Function('AudioWorkletProcessor', 'sampleRate', 'registerProcessor', source)(
    class { constructor() { this.port = { close() {}, postMessage() {}, onmessage: null } } },
    rate, (_, implementation) => { Processor = implementation }
  )
  const processor = new Processor()
  await processor.ready
  assert.ok(processor.module, "WASM initialized")
  return processor
}

async function render({ rate = 48000, duration = 1.2, signal, params = {}, change, observe, blockSize = 128 }) {
  const processor = await processorFor(rate)
  const count = Math.ceil(rate * duration / blockSize) * blockSize
  const input = [new Float32Array(blockSize), new Float32Array(blockSize)]
  const output = [new Float32Array(blockSize), new Float32Array(blockSize)]
  const channels = [new Float32Array(count), new Float32Array(count)]
  const original = [new Float32Array(count), new Float32Array(count)]
  const parameters = Object.fromEntries(Object.entries({ key: 0, scale: 0, retune: 0, wet: 1, ...params })
    .map(([key, value]) => [key, new Float32Array([value])]))
  for (let start = 0; start < count; start += blockSize) {
    if (change) change(start / rate, parameters)
    for (let i = 0; i < blockSize; i++) {
      const value = signal((start + i) / rate, start + i)
      input[0][i] = Array.isArray(value) ? value[0] : value
      input[1][i] = Array.isArray(value) ? value[1] : value
      original[0][start + i] = input[0][i]
      original[1][start + i] = input[1][i]
    }
    assert.equal(processor.process([input], [output], parameters), true)
    if (observe) observe(processor.controller, start / rate)
    for (let c = 0; c < 2; c++) channels[c].set(output[c], start)
  }
  for (const channel of channels) for (const value of channel) assert.ok(Number.isFinite(value), 'finite audio')
  return { channels, original, rate, processor }
}

function frequency(samples, rate, from = 0.5, to = 1.1) {
  let first = null, last = 0, crossings = 0
  for (let i = Math.floor(from * rate) + 1; i < Math.min(samples.length, to * rate); i++) {
    if (samples[i - 1] <= 0 && samples[i] > 0) {
      const position = i - 1 - samples[i - 1] / (samples[i] - samples[i - 1])
      if (first === null) first = position
      last = position
      crossings++
    }
  }
  return (crossings - 1) * rate / (last - first)
}
const tone = hz => t => 0.3 * Math.sin(2 * Math.PI * hz * t)
const cents = (actual, expected) => 1200 * Math.log2(actual / expected)
// Note-target acceptance, not precision calibration. The auditioned engine's
// frequency bias remains tracked by signalsmith-checks.mjs (5-cent requirement).
const NOTE_TOLERANCE_CENTS = 20

for (const rate of [44100, 48000, 96000]) {
  test(`chromatic tuning up/down across vocal range at ${rate}Hz`, async () => {
    for (const hz of [82, 113, 215, 287, 432, 452, 763]) {
      const { channels } = await render({ rate, signal: tone(hz) })
      const note = Math.round(69 + 12 * Math.log2(hz / 440))
      const expected = 440 * 2 ** ((note - 69) / 12)
      const measured = frequency(channels[0], rate)
      assert.ok(Math.abs(cents(measured, expected)) < NOTE_TOLERANCE_CENTS, `${hz}Hz → ${measured.toFixed(3)}Hz, expected ${expected.toFixed(3)}Hz`)
    }
  })
}

test('key and scale choose different allowed notes, including octave boundaries', async () => {
  for (const [hz, key, scale, expected] of [
    [277, 0, 1, 261.625565], [315, 0, 1, 329.627557],
    [315, 0, 2, 311.126984], [277, 2, 1, 277.182631], [499, 0, 1, 493.883301]
  ]) {
    const { channels, rate } = await render({ signal: tone(hz), params: { key, scale } })
    const measured = frequency(channels[0], rate)
    assert.ok(Math.abs(cents(measured, expected)) < NOTE_TOLERANCE_CENTS, `${hz}, key=${key}, scale=${scale}: ${measured}, expected ${expected}`)
  }
})

test('silence, DC and unvoiced noise pass without pitch artifacts', async () => {
  let seed = 1
  for (const signal of [() => 0, () => 0.2, () => {
    seed = (Math.imul(1664525, seed) + 1013904223) | 0
    return (seed / 2147483648) * 0.2
  }]) {
    const { channels, original, processor, rate } = await render({ signal })
    let error = 0
    for (let i = rate / 2; i < channels[0].length; i++) {
      error = Math.max(error, Math.abs(channels[0][i] - original[0][i - processor.latency]))
    }
    assert.ok(error < 1e-5, `unvoiced maximum error ${error}`)
  }
})

test('dry mix has exactly 90ms latency and no steady-state coloration', async () => {
  const { channels, original, processor, rate } = await render({ signal: tone(432), params: { wet: 0 } })
  let error = 0
  for (let i = rate / 2; i < channels[0].length; i++) {
    error = Math.max(error, Math.abs(channels[0][i] - original[0][i - processor.latency]))
  }
  assert.ok(error < 1e-6)
  assert.equal(processor.latency, Math.round(rate * 0.09))
})

test('stereo amplitude and polarity survive correction; right-only input still tracks', async () => {
  for (const signal of [t => { const v = tone(432)(t); return [v, -v * 0.4] }, t => [0, tone(432)(t)]]) {
    const { channels, rate } = await render({ signal })
    const measured = frequency(channels[1], rate)
    assert.ok(Math.abs(cents(measured, 440)) < 5)
    if (signal(0.001)[0]) {
      for (let i = rate / 2; i < channels[0].length; i++) assert.ok(Math.abs(channels[1][i] + channels[0][i] * 0.4) < 1e-6)
    } else assert.ok(channels[0].every(v => v === 0))
  }
})

test('retune controls convergence and key/scale changes apply live', async () => {
  const fast = await render({ signal: tone(432), params: { retune: 0 } })
  const slow = await render({ signal: tone(432), params: { retune: 300 } })
  assert.ok(frequency(fast.channels[0], fast.rate, 0.12, 0.2) > frequency(slow.channels[0], slow.rate, 0.12, 0.2) + 2)
  const live = await render({ duration: 2, signal: tone(315), params: { scale: 2 }, change: (t, p) => {
    if (t >= 1) p.scale[0] = 1
  } })
  assert.ok(Math.abs(cents(frequency(live.channels[0], live.rate, 0.5, 0.9), 311.126984)) < 6)
  assert.ok(Math.abs(cents(frequency(live.channels[0], live.rate, 1.5, 1.9), 329.627557)) < 6)
})

test('no input and disposal are safe; nonstandard render quantum works', async () => {
  const processor = await processorFor(48000)
  const parameters = { key: [0], scale: [0], retune: [0], wet: [1] }
  const output = [[new Float32Array(256), new Float32Array(256)]]
  assert.equal(processor.process([], output, parameters), true)
  assert.ok(output[0][0].every(v => v === 0))
  processor.port.onmessage({ data: 'dispose' })
  assert.equal(processor.process([], output, parameters), false)
  const result = await render({ signal: tone(432), blockSize: 256 })
  assert.ok(Math.abs(cents(frequency(result.channels[0], result.rate), 440)) < 5)
})

function amplitudeAt(samples, rate, hz, start = 0.5, duration = 0.5) {
  let real = 0, imaginary = 0
  const first = Math.round(start * rate), count = Math.round(duration * rate)
  for (let i = first; i < first + count; i++) {
    real += samples[i] * Math.cos(2 * Math.PI * hz * i / rate)
    imaginary += samples[i] * Math.sin(2 * Math.PI * hz * i / rate)
  }
  return 2 * Math.hypot(real, imaginary) / count
}

test('steady correction has little spurious energy or gain modulation', async () => {
  for (const hz of [113, 215, 432, 452]) {
    const { channels, rate } = await render({ signal: tone(hz) })
    const samples = channels[0]
    const measured = frequency(samples, rate)
    const amplitude = amplitudeAt(samples, rate, measured)
    let power = 0
    for (let i = rate / 2; i < rate; i++) power += samples[i] ** 2
    power /= rate / 2
    assert.ok(amplitude > 0.28 && amplitude < 0.32, `amplitude ${amplitude}`)
    assert.ok(amplitude ** 2 / 2 / power > 0.99, 'at least 99% of steady sine energy stays at the target frequency')
  }
})

test('a stronger second harmonic does not mislead the note tracker', async () => {
  const hz = 215
  const { channels, rate, processor } = await render({ signal: t =>
    0.12 * Math.sin(2 * Math.PI * hz * t) +
    0.18 * Math.sin(4 * Math.PI * hz * t) +
    0.08 * Math.sin(6 * Math.PI * hz * t)
  })
  // The second harmonic is louder than the fundamental: picking the loudest
  // spectral peak would produce the wrong octave.
  assert.equal(processor.controller.target, 57) // A3, not A4
  assert.ok(Math.abs(processor.controller.frequency - hz) < 1)
  let fundamental = 0
  for (let f = 217; f <= 223; f += 0.25) fundamental = Math.max(fundamental, amplitudeAt(channels[0], rate, f))
  assert.ok(fundamental > 0.07, `fundamental survives: ${fundamental}`)
})

test('hard correction suppresses vibrato without losing the note', async () => {
  let phase = 0
  const { channels, rate } = await render({ duration: 2, signal: t => {
    phase += 2 * Math.PI * (432 + 5 * Math.sin(2 * Math.PI * 5 * t)) / 48000
    return 0.3 * Math.sin(phase)
  } })
  for (let start = 0.5; start < 1.8; start += 0.1) {
    assert.ok(Math.abs(cents(frequency(channels[0], rate, start, start + 0.08), 440)) < 12)
  }
})

test('an already tuned note does not cancel at half dry/wet', async () => {
  for (const hz of [110, 220, 440, 880]) {
    const { channels, rate } = await render({ signal: tone(hz), params: { wet: 0.5 } })
    assert.ok(amplitudeAt(channels[0], rate, hz) > 0.29, `${hz}Hz should keep its level at 50% mix`)
  }
})

test('pentatonic targeting turns a continuous vocal glide into allowed note steps', async () => {
  const { SCALES } = await import('../src/audio/pitch-controller.mjs')
  for (const scale of [3, 4]) {
    let phase = 0
    const targets = new Set()
    await render({ duration: 3, params: { key: 2, scale, retune: 0 }, signal: t => {
      const hz = 440 * 2 ** ((54 + t * 4 - 69) / 12)
      phase += 2 * Math.PI * hz / 48000
      return 0.2 * Math.sin(phase) + 0.1 * Math.sin(2 * phase) + 0.04 * Math.sin(3 * phase)
    }, observe: (controller, t) => {
      if (t < 0.2 || !controller.voiced) return
      targets.add(controller.target)
      assert.ok(SCALES[scale].includes(((controller.target - 2) % 12 + 12) % 12))
      assert.ok(Math.abs(controller.inputMidi + controller.correction - controller.target) < 0.016)
    } })
    assert.ok(targets.size >= 4, `glide must visit several distinct notes: ${[...targets]}`)
  }
})

test('controller holds note boundaries, responds to key changes and releases unvoiced sound', async () => {
  const { PitchController } = await import('../src/audio/pitch-controller.mjs')
  const c = new PitchController()
  const step = (note, key = 0, scale = 0, retune = 0) => c.update(440 * 2 ** ((note - 69) / 12), 0.99, 0.005, key, scale, retune)
  step(60.45)
  for (let i = 0; i < 20; i++) step(i % 2 ? 60.53 : 60.47)
  assert.equal(c.target, 60, 'do not chatter at the half-semitone boundary')
  for (let i = 0; i < 3; i++) step(60.7)
  assert.equal(c.target, 61)
  step(60.7, 0, 1)
  assert.equal(c.target, 60, 'C major disallows C sharp')
  step(60.7, 1, 1)
  assert.equal(c.target, 61, 'changing Key takes effect without rebuilding')
  c.update(0, 0, 0.005, 1, 1, 0)
  assert.equal(c.voiced, true, 'brief uncertain frame is held')
  for (let i = 0; i < 8; i++) c.update(0, 0, 0.005, 1, 1, 0)
  assert.equal(c.voiced, false)
  assert.ok(Number.isNaN(c.target))
})

test('voiced/unvoiced transitions recover cleanly without a stuck correction', async () => {
  let seed = 1
  const { channels, original, processor, rate } = await render({ duration: 2, signal: t => {
    if (t < 0.6 || t >= 1.2) return tone(315)(t)
    seed = (Math.imul(1664525, seed) + 1013904223) | 0
    return seed / 2147483648 * 0.15
  }, params: { scale: 1 } })
  let error = 0
  for (let i = Math.round(1.05 * rate); i < Math.round(1.18 * rate); i++) {
    error = Math.max(error, Math.abs(channels[0][i] - original[0][i - processor.latency]))
  }
  assert.ok(error < 0.0001, `unvoiced section passes dry: ${error}`)
  assert.ok(Math.abs(cents(frequency(channels[0], rate, 1.6, 1.9), 329.627557)) < NOTE_TOLERANCE_CENTS)
})
