export const SCALES = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  [0, 2, 4, 5, 7, 9, 11],
  [0, 2, 3, 5, 7, 8, 10],
  [0, 2, 4, 7, 9],
  [0, 3, 5, 7, 10]
]

export class PitchController {
  constructor() {
    this.target = NaN
    this.inputMidi = NaN
    this.frequency = 0
    this.correction = 0
    this.voiced = false
    this.confidence = 0
    this.lostTime = 1
    this.key = -1
    this.scale = -1
    this.notes = new Float64Array(3)
    this.noteIndex = 0
  }

  nearest(note) {
    let nearest = Math.round(note), distance = Infinity
    for (let candidate = Math.floor(note) - 6; candidate <= Math.ceil(note) + 6; candidate++) {
      if (!SCALES[this.scale].includes(((candidate - this.key) % 12 + 12) % 12)) continue
      const delta = Math.abs(candidate - note)
      if (delta < distance) { nearest = candidate; distance = delta }
    }
    // Keep a held note near a boundary, without flattening intentional slides.
    if (Number.isFinite(this.target) && Math.abs(this.target - note) <= distance + 0.12) return this.target
    return nearest
  }

  update(frequency, clarity, dt, key, scale, retune) {
    key = Math.max(0, Math.min(11, Math.round(key)))
    scale = Math.max(0, Math.min(SCALES.length - 1, Math.round(scale)))
    if (key !== this.key || scale !== this.scale) {
      this.key = key; this.scale = scale; this.target = NaN
    }
    this.confidence = clarity
    const valid = frequency >= 70 && frequency <= 1000 && clarity >= (this.voiced ? 0.72 : 0.85)
    if (!valid) {
      this.lostTime += dt
      // Brief uncertain frames shouldn't make the voice flutter dry/wet.
      if (this.lostTime <= 0.025) return
      this.voiced = false
      this.target = NaN
      this.inputMidi = NaN
      this.frequency = 0
      this.correction *= Math.exp(-dt / 0.015)
      return
    }
    const note = 69 + 12 * Math.log2(frequency / 440)
    if (!this.voiced) this.notes.fill(note)
    this.notes[this.noteIndex] = note
    this.noteIndex = (this.noteIndex + 1) % 3
    const [a, b, c] = this.notes
    const median = a + b + c - Math.min(a, b, c) - Math.max(a, b, c)
    this.inputMidi = median
    this.frequency = 440 * 2 ** ((median - 69) / 12)
    this.lostTime = 0
    this.voiced = true
    this.target = this.nearest(median)
    // Avoid needlessly processing a note already within 1.5 cents of target.
    // Tiny detector fluctuations otherwise create beating at partial Mix.
    const error = this.target - median
    const desired = Math.abs(error) < 0.015 ? 0 : error
    const alpha = retune <= 0 ? 1 : 1 - Math.exp(-dt / (retune / 1000))
    this.correction += alpha * (desired - this.correction)
  }
}
