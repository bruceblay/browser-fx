/* global createAutoTune, getTabState, buildChainForTab, cleanupTabState,
          updateEffectParamsForTab, setMasterBypass, audioContext, prepareAutoTune */
const status = document.getElementById('status')
const urls = []
const rate = 48000
let liveSession = null
let connecting = false
let originalOnly = false

function controlValues() {
  return {
    key: document.getElementById('key').selectedIndex,
    scale: document.getElementById('scale').selectedIndex,
    retune: Number(document.getElementById('retune').value),
    wet: Number(document.getElementById('wet').value) / 100
  }
}

function updateButtons() {
  document.getElementById('connect').disabled = connecting || !!liveSession
  document.getElementById('compare').disabled = !liveSession
  document.getElementById('stop').disabled = !liveSession
  document.getElementById('render').disabled = connecting || !!liveSession
  document.getElementById('check').disabled = connecting || !!liveSession
  document.getElementById('compare').textContent = originalOnly ? 'Hear Auto Tune' : 'Hear original'
  document.getElementById('compare').setAttribute('aria-pressed', String(originalOnly))
}

function showLiveStatus() {
  if (!liveSession) return
  status.textContent = `${originalOnly ? 'Original' : 'Auto Tune'} — live tab audio. Controls update as you listen. Stop restores normal playback in the source tab.`
}

async function stopLive(message = 'Stopped. Normal playback is restored in the source tab.') {
  const session = liveSession
  liveSession = null
  originalOnly = false
  if (session) {
    session.stream.getTracks().forEach(track => { track.onended = null; track.stop() })
    session.source.disconnect()
    session.effect.dispose()
    await session.context.close()
  }
  updateButtons()
  status.textContent = message
  document.getElementById('tracking').textContent = 'Waiting for a voice.'
}

async function connectLive() {
  if (connecting || liveSession) return
  if (!navigator.mediaDevices?.getDisplayMedia) {
    status.textContent = 'This browser does not support tab audio sharing. Open this same localhost address in Google Chrome, with YouTube in another Chrome tab.'
    return
  }
  connecting = true
  updateButtons()
  status.textContent = 'Select the playing YouTube tab and enable Share tab audio.'
  let stream, context, effect, source
  try {
    // Invoke from the click, before any awaits: the browser requires a user
    // gesture. Video is required by getDisplayMedia but is never displayed,
    // recorded or transmitted. Exclude this tab and system audio to avoid
    // capturing our own processed output in a feedback loop.
    const capture = navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: 'browser' },
      audio: { suppressLocalAudioPlayback: true, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      selfBrowserSurface: 'exclude', systemAudio: 'exclude',
      surfaceSwitching: 'exclude', monitorTypeSurfaces: 'exclude'
    })
    context = new AudioContext({ latencyHint: 'interactive' })
    // Resume while the click still supplies activation; loading happens after
    // the picker. Promise.all attaches rejection handlers to both operations.
    const outcomes = await Promise.allSettled([capture, context.resume()])
    if (outcomes[0].status === 'fulfilled') stream = outcomes[0].value
    for (const outcome of outcomes) if (outcome.status === 'rejected') throw outcome.reason
    if (!stream.getAudioTracks().length) throw new Error('No tab audio was shared. Connect again, choose the Chrome Tab list, and enable Share tab audio.')
    const surface = stream.getVideoTracks()[0]?.getSettings().displaySurface
    if (surface && surface !== 'browser') throw new Error('Choose a browser tab instead of a window or screen so only that tab’s audio is processed.')
    await context.audioWorklet.addModule('../autotune-worklet.js')
    if (stream.getAudioTracks()[0].readyState !== 'live') throw new Error('Sharing ended before audio was ready. Connect again.')
    audioContext = context
    effect = createAutoTune(context, controlValues(), {})
    const ready = await effect.ready
    if (!ready.ok) throw new Error(ready.message)
    if (stream.getAudioTracks()[0].readyState !== 'live') throw new Error('Sharing ended before the engine was ready.')
    effect.setTelemetry(data => {
      const names = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B']
      const note = midi => `${names[((Math.round(midi) % 12) + 12) % 12]}${Math.floor(Math.round(midi) / 12) - 1}`
      document.getElementById('tracking').textContent = data.voiced
        ? `${note(data.input)} → ${note(data.target)} · ${data.correction >= 0 ? '+' : ''}${data.correction.toFixed(2)} semitones · tracking ${Math.round(data.confidence * 100)}%`
        : 'Unvoiced sound — passing through.'
    })
    source = context.createMediaStreamSource(stream)
    source.connect(effect.input)
    effect.output.connect(context.destination)
    document.querySelectorAll('audio').forEach(player => player.pause())
    liveSession = { stream, context, source, effect }
    originalOnly = false
    stream.getTracks().forEach(track => {
      track.onended = () => { if (liveSession?.stream === stream) void stopLive('Tab sharing ended. Connect a tab to listen again.') }
    })
    showLiveStatus()
  } catch (error) {
    if (stream) stream.getTracks().forEach(track => track.stop())
    if (source) source.disconnect()
    if (effect) effect.dispose()
    if (context && context.state !== 'closed') await context.close()
    status.textContent = error.name === 'NotAllowedError'
      ? 'Sharing was cancelled or blocked. Open this page in Chrome, click Connect YouTube tab, and select a tab with Share tab audio enabled.'
      : error.message
  } finally {
    connecting = false
    updateButtons()
  }
}

document.getElementById('connect').onclick = connectLive
document.getElementById('stop').onclick = () => stopLive()
document.getElementById('compare').onclick = () => {
  if (!liveSession) return
  originalOnly = !originalOnly
  liveSession.effect.update({ wet: originalOnly ? 0 : controlValues().wet })
  updateButtons()
  showLiveStatus()
}
for (const id of ['key', 'scale', 'retune', 'wet']) {
  document.getElementById(id).addEventListener('input', () => {
    if (!liveSession) return
    liveSession.effect.update({ ...controlValues(), ...(originalOnly ? { wet: 0 } : {}) })
  })
}
window.addEventListener('pagehide', () => { void stopLive() })

function vowel() {
  const buffer = new AudioBuffer({ numberOfChannels: 1, length: rate * 6, sampleRate: rate })
  const x = buffer.getChannelData(0)
  const notes = [57.32, 59.25, 60.7, 64.3, 62.25, 60.2]
  let phase = 0
  for (let i = 0; i < x.length; i++) {
    const time = i / rate, part = time % 1
    const note = notes[Math.floor(time)] + 0.18 * Math.sin(2 * Math.PI * 5 * time)
    const frequency = 440 * 2 ** ((note - 69) / 12)
    phase += 2 * Math.PI * frequency / rate
    const envelope = Math.min(1, part / 0.04, (1 - part) / 0.08)
    let sample = 0
    for (let harmonic = 1; harmonic <= 20; harmonic++) {
      const hz = harmonic * frequency
      const formants = Math.exp(-(((hz - 700) / 180) ** 2)) + 0.7 * Math.exp(-(((hz - 1200) / 250) ** 2))
      sample += Math.sin(phase * harmonic) * (0.15 + formants) / harmonic
    }
    x[i] = sample * envelope * 0.35
  }
  return buffer
}

function waveURL(buffer, offset = 0, frames = buffer.length - offset) {
  const channels = buffer.numberOfChannels
  const data = new ArrayBuffer(44 + frames * channels * 2)
  const view = new DataView(data)
  const text = (at, value) => { for (let i = 0; i < value.length; i++) view.setUint8(at + i, value.charCodeAt(i)) }
  text(0, 'RIFF'); view.setUint32(4, data.byteLength - 8, true); text(8, 'WAVE')
  text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true)
  view.setUint16(22, channels, true); view.setUint32(24, buffer.sampleRate, true)
  view.setUint32(28, buffer.sampleRate * channels * 2, true)
  view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true)
  text(36, 'data'); view.setUint32(40, frames * channels * 2, true)
  for (let c = 0; c < channels; c++) {
    const samples = buffer.getChannelData(c)
    for (let i = 0; i < frames; i++) view.setInt16(44 + (i * channels + c) * 2, Math.max(-1, Math.min(1, samples[i + offset])) * 32767, true)
  }
  const url = URL.createObjectURL(new Blob([data], { type: 'audio/wav' }))
  urls.push(url)
  return url
}

async function renderComparison() {
  status.textContent = 'Rendering…'
  const original = vowel()
  const frames = Math.min(original.length, rate * 15)
  const latency = Math.round(rate * 0.09)
  const context = new OfflineAudioContext(2, frames + latency, rate)
  await context.audioWorklet.addModule('../autotune-worklet.js')
  const source = context.createBufferSource()
  source.buffer = original
  const effect = createAutoTune(context, controlValues(), {})
  const ready = await effect.ready
  if (!ready.ok) throw new Error(ready.message)
  source.connect(effect.input)
  effect.output.connect(context.destination)
  source.start(0); source.stop(frames / rate)
  const rendered = await context.startRendering()
  effect.dispose()
  for (const url of urls) URL.revokeObjectURL(url)
  urls.length = 0
  document.getElementById('original').src = waveURL(original, 0, frames)
  document.getElementById('corrected').src = waveURL(rendered, latency, frames)
  status.textContent = 'Synthetic comparison ready. Use Connect YouTube tab above to listen to a real voice live.'
  return { frames, latency, channels: rendered.numberOfChannels }
}

function measuredFrequency(samples, start, end) {
  let first = null, last = 0, count = 0
  for (let i = Math.round(start * rate) + 1; i < Math.round(end * rate); i++) {
    if (samples[i - 1] <= 0 && samples[i] > 0) {
      const position = i - 1 - samples[i - 1] / (samples[i] - samples[i - 1])
      if (first === null) first = position
      last = position; count++
    }
  }
  return (count - 1) * rate / (last - first)
}

window.runAutoTuneChecks = async function () {
  const results = []
  const check = (condition, message) => { if (!condition) throw new Error(message) }
  // Use the packaged worklet here too: catches omissions in copy/build scripts.
  for (const enabled of [true, false]) {
    const context = new OfflineAudioContext(2, rate * 2, rate)
    await context.audioWorklet.addModule('../build/chrome-mv3-prod/autotune-worklet.js')
    audioContext = context
    const state = getTabState(901)
    const oscillator = context.createOscillator()
    oscillator.frequency.value = 432
    const gain = context.createGain(); gain.gain.value = 0.2
    oscillator.connect(gain)
    state.sourceNode = gain
    state.destinationNode = context.createGain()
    state.destinationNode.connect(context.destination)
    buildChainForTab([
      { effectId: 'autotune', params: { retune: 0, scale: 0 }, enabled },
      { effectId: 'utility', params: { gain: 0, pan: 0, width: 1 } }
    ], 901)
    for (const slot of state.chain) if (slot.effect.ready) check((await slot.effect.ready).ok, 'Engine ready')
    oscillator.start()
    const rendered = await context.startRendering()
    const frequency = measuredFrequency(rendered.getChannelData(0), 1, 1.9)
    check(Math.abs(1200 * Math.log2(frequency / (enabled ? 440 : 432))) < 20, `Unexpected pitch ${frequency}`)
    results.push(`${enabled ? 'Tuned + Utility' : 'Bypassed + Utility'}: ${frequency.toFixed(3)}Hz`)
    cleanupTabState(901)
  }
  const context = new OfflineAudioContext(2, rate * 3, rate)
  audioContext = context
  await prepareAutoTune(context)
  const state = getTabState(902)
  const oscillator = context.createOscillator(); oscillator.frequency.value = 315
  state.sourceNode = oscillator
  state.destinationNode = context.createGain(); state.destinationNode.connect(context.destination)
  buildChainForTab([{ effectId: 'autotune', params: { scale: 2, retune: 0 } }], 902)
  for (const slot of state.chain) if (slot.effect.ready) check((await slot.effect.ready).ok, 'Engine ready')
  const changeScale = context.suspend(1).then(() => {
    updateEffectParamsForTab('autotune', { scale: 1 }, 902, 0)
    context.resume()
  })
  const bypass = context.suspend(2).then(() => { setMasterBypass(902, true); context.resume() })
  oscillator.start()
  const rendered = await context.startRendering()
  await Promise.all([changeScale, bypass])
  const samples = rendered.getChannelData(0)
  for (const [start, end, target] of [[0.5, 0.9, 311.126984], [1.5, 1.9, 329.627557], [2.5, 2.9, 315]]) {
    const frequency = measuredFrequency(samples, start, end)
    check(Math.abs(1200 * Math.log2(frequency / target)) < 20, `Live controls: ${frequency} vs ${target}`)
    results.push(`Live ${target.toFixed(3)}Hz target: ${frequency.toFixed(3)}Hz`)
  }
  cleanupTabState(902)
  results.push('PASS — packaged worklet, effect chain, slot bypass, live controls, master bypass and cleanup')
  status.textContent = results.join('\n')
  return results
}

for (const [id, action] of [['render', renderComparison], ['check', window.runAutoTuneChecks]]) {
  document.getElementById(id).onclick = async () => {
    const buttons = document.querySelectorAll('button')
    buttons.forEach(button => { button.disabled = true })
    try { await action() } catch (error) { status.textContent = error.stack }
    finally { updateButtons() }
  }
}
