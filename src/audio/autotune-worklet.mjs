import createStretch from 'signalsmith-stretch-wasm'
import { PitchDetector } from 'pitchy'
import { PitchController } from './pitch-controller.mjs'

// 80 ms analysis / 10 ms hop: preserve the auditioned spectral texture while
// reducing the 120 ms audition's transition smear. Splitting FFT work adds 10 ms.
const WINDOW_SECONDS = 0.08
const INTERVAL_SECONDS = 0.01

class AutoTuneProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'key', defaultValue: 0, minValue: 0, maxValue: 11, automationRate: 'k-rate' },
      { name: 'scale', defaultValue: 1, minValue: 0, maxValue: 4, automationRate: 'k-rate' },
      { name: 'retune', defaultValue: 0, minValue: 0, maxValue: 300, automationRate: 'k-rate' },
      { name: 'wet', defaultValue: 1, minValue: 0, maxValue: 1, automationRate: 'k-rate' }
    ]
  }

  constructor() {
    super()
    this.stopped = false
    this.failed = false
    this.telemetry = false
    this.time = 0
    this.engineSamples = 0
    this.latency = Math.round(sampleRate * WINDOW_SECONDS) + Math.round(sampleRate * INTERVAL_SECONDS)
    const size = 2 ** Math.ceil(Math.log2(sampleRate * 0.5))
    this.mask = size - 1
    this.left = new Float32Array(size)
    this.right = new Float32Array(size)
    this.decimation = Math.max(1, Math.floor(sampleRate / 12000))
    this.analysisRate = sampleRate / this.decimation
    this.analysisL = new Float32Array(512)
    this.analysisR = new Float32Array(512)
    this.frame = new Float32Array(512)
    this.analysisCount = 0
    this.hop = Math.round(sampleRate * 0.005)
    this.filterL = new Float64Array(2)
    this.filterR = new Float64Array(2)
    this.filterAlpha = 1 - Math.exp(-2 * Math.PI * 1800 / sampleRate)
    this.detector = PitchDetector.forFloat32Array(512)
    this.detector.clarityThreshold = 0.9
    this.detector.minVolumeAbsolute = 0.002
    this.controller = new PitchController()
    this.historyTimes = new Float64Array(256).fill(-Infinity)
    this.historyCorrections = new Float32Array(256)
    this.historyVoicing = new Float32Array(256)
    this.historyFrequency = new Float32Array(256)
    this.historyCount = 0
    this.voiceMix = 0
    this.wet = 1
    this.fadeAlpha = 1 - Math.exp(-1 / (sampleRate * 0.008))
    this.port.onmessage = ({ data }) => {
      if (data === 'dispose') {
        this.stopped = true
        this.module = null
        this.inputs = this.outputs = null
        this.port.close()
      } else if (data?.type === 'telemetry') this.telemetry = !!data.enabled
    }
    // Each instance owns its WASM memory and DSP state. The engine itself is
    // unchanged from the pinned, auditioned Signalsmith release.
    this.ready = createStretch().then(module => {
      if (this.stopped) return
      module._configure(2, Math.round(sampleRate * WINDOW_SECONDS), Math.round(sampleRate * INTERVAL_SECONDS), true)
      module._reset()
      this.inputLatency = module._inputLatency()
      const latency = this.inputLatency + module._outputLatency()
      if (latency !== this.latency) throw new Error(`Unexpected engine latency: ${latency}`)
      this.capacity = 2048
      this.pointer = module._setBuffers(2, this.capacity)
      this.module = module
      this.refreshViews()
      module._setFormantSemitones(0, true)
      this.port.postMessage({ type: 'ready', latency: this.latency / sampleRate })
    }).catch(error => {
      this.failed = true
      this.module = null
      this.port.postMessage({ type: 'error', message: String(error) })
    })
  }

  refreshViews() {
    const memory = this.module.HEAP8.buffer
    if (memory === this.memory) return
    this.memory = memory
    this.inputs = [0, 1].map(c => new Float32Array(memory, this.pointer + this.capacity * 4 * c, this.capacity))
    this.outputs = [2, 3].map(c => new Float32Array(memory, this.pointer + this.capacity * 4 * c, this.capacity))
  }

  analyse(now, parameters) {
    if (this.analysisCount < 512) return
    let energyL = 0, energyR = 0
    for (let i = 0; i < 512; i++) {
      energyL += this.analysisL[i] ** 2
      energyR += this.analysisR[i] ** 2
    }
    // Preserve opposite-polarity stereo and right-only sources.
    const signal = energyR > energyL * 4 ? this.analysisR : this.analysisL
    let mean = 0
    for (let i = 0; i < 512; i++) {
      const value = signal[(this.analysisCount + i) & 511]
      this.frame[i] = value
      mean += value
    }
    mean /= 512
    for (let i = 0; i < 512; i++) this.frame[i] -= mean
    const [frequency, clarity] = this.detector.findPitch(this.frame, this.analysisRate)
    this.controller.update(frequency, clarity, this.hop / sampleRate, parameters.key[0], parameters.scale[0], parameters.retune[0])
    const index = this.historyCount++ & 255
    // Stamp the frame's centre in source time. The shifter looks up correction
    // at its input-latency offset; output voicing looks it up at total latency.
    this.historyTimes[index] = now - 256 * this.decimation
    this.historyCorrections[index] = this.controller.correction
    this.historyVoicing[index] = this.controller.voiced ? 1 : 0
    this.historyFrequency[index] = this.controller.frequency
    if (this.telemetry && this.historyCount % 20 === 0) {
      this.port.postMessage({ type: 'pitch', input: this.controller.inputMidi, target: this.controller.target,
        confidence: clarity, voiced: this.controller.voiced, correction: this.controller.correction })
    }
  }

  historyAt(time) {
    for (let age = 0; age < Math.min(256, this.historyCount); age++) {
      const index = (this.historyCount - 1 - age) & 255
      if (this.historyTimes[index] <= time) return index
    }
    return -1
  }

  process(inputs, outputs, parameters) {
    if (this.stopped) return false
    const output = outputs[0]
    if (!output?.length) return true
    const count = output[0].length
    const left = inputs[0]?.[0], right = inputs[0]?.[1] || left
    const start = this.time
    for (let i = 0; i < count; i++) {
      const t = this.time++, index = t & this.mask
      let l = Number.isFinite(left?.[i]) ? left[i] : 0
      let r = Number.isFinite(right?.[i]) ? right[i] : 0
      this.left[index] = l; this.right[index] = r
      for (let stage = 0; stage < 2; stage++) {
        this.filterL[stage] += this.filterAlpha * (l - this.filterL[stage])
        this.filterR[stage] += this.filterAlpha * (r - this.filterR[stage])
        l = this.filterL[stage]; r = this.filterR[stage]
      }
      if (t % this.decimation === 0) {
        this.analysisL[this.analysisCount & 511] = l
        this.analysisR[this.analysisCount & 511] = r
        ++this.analysisCount
      }
      if (t % this.hop === 0) this.analyse(t, parameters)
    }
    const module = this.module
    if (module && count <= this.capacity) {
      this.refreshViews()
      for (let i = 0; i < count; i++) {
        this.inputs[0][i] = this.left[(start + i) & this.mask]
        this.inputs[1][i] = this.right[(start + i) & this.mask]
      }
      const index = this.historyAt(this.time - count / 2 - this.inputLatency)
      module._setTransposeSemitones(index >= 0 ? this.historyCorrections[index] : 0, 0)
      module._setFormantBase(index >= 0 ? this.historyFrequency[index] / sampleRate : 0)
      module._process(count, count)
      this.refreshViews()
      this.engineSamples += count
    }
    const warmedUp = module && count <= this.capacity && this.engineSamples >= this.latency + count
    const wet = parameters.wet[0]
    for (let i = 0; i < count; i++) {
      const t = start + i, dryTime = t - this.latency
      const index = this.historyAt(dryTime)
      const voiced = warmedUp && index >= 0 ? this.historyVoicing[index] : 0
      this.voiceMix += this.fadeAlpha * (voiced - this.voiceMix)
      this.wet += this.fadeAlpha * (wet - this.wet)
      const mix = warmedUp ? this.voiceMix * this.wet : 0
      const dryL = dryTime >= 0 ? this.left[dryTime & this.mask] : 0
      const dryR = dryTime >= 0 ? this.right[dryTime & this.mask] : 0
      output[0][i] = dryL * (1 - mix) + (mix ? this.outputs[0][i] * mix : 0)
      if (output[1]) output[1][i] = dryR * (1 - mix) + (mix ? this.outputs[1][i] * mix : 0)
    }
    return true
  }
}

registerProcessor('browser-fx-autotune', AutoTuneProcessor)
