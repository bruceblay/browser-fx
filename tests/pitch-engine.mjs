import { createComparison } from './signalsmith-engine.mjs'
import { runSignalChecks } from './signalsmith-checks.mjs'

const $ = id => document.getElementById(id)
let session = null
let connecting = false
let checking = false
let generation = 0
let mode = 'original'
let modeRevision = 0

function updateUI() {
  $('connect').disabled = connecting || checking || !!session
  $('profile').disabled = connecting || checking || !!session
  $('controls').disabled = !session
  $('stop').disabled = !session && !connecting
  $('check').disabled = connecting || checking || !!session
  for (const button of document.querySelectorAll('[data-mode]')) {
    button.setAttribute('aria-pressed', String(button.dataset.mode === mode))
  }
}

function describe() {
  if (!session) return
  const names = { original: 'Original', unity: 'Processed, no pitch shift', down: '3 semitones down', up: '3 semitones up', steps: `Alternating −3 / +3 every ${$('interval').value} ms` }
  $('status').textContent = `${names[mode]} · ${$('formants').checked ? 'vocal character preserved' : 'formants shift with pitch'}\nEngine delay: ${Math.round(session.effect.latency * 1000)} ms, plus capture and audio device delay.`
}

async function stop(message = 'Stopped. Normal playback is restored in the source tab.') {
  ++generation
  ++modeRevision
  const old = session
  session = null
  mode = 'original'
  // A pending chooser can't be dismissed by script. Its eventual stream is
  // discarded by the generation check in connect(), including after pagehide.
  if (old) {
    clearInterval(old.steps)
    clearInterval(old.meter)
    old.stream.getTracks().forEach(track => { track.onended = null; track.stop() })
    old.source.disconnect()
    old.effect.dispose()
    await old.context.close()
  }
  $('status').textContent = message
  $('meter').textContent = 'Both paths use the same volume and buffering delay.'
  updateUI()
}

async function selectMode(next) {
  const active = session
  if (!active) return
  const revision = ++modeRevision
  clearInterval(active.steps)
  mode = next
  const pitch = next === 'up' ? 3 : next === 'down' || next === 'steps' ? -3 : 0
  let step = pitch
  try {
    await active.effect.setPitch(pitch, $('formants').checked)
    if (session !== active || modeRevision !== revision) return
    active.effect.selectOriginal(next === 'original')
    if (next === 'steps') {
      // An audition of reactive changes through the public API, not a musical
      // clock or the eventual automatic pitch controller. Timer pauses in a
      // background tab are avoided by stopping the sequence on visibilitychange.
      active.steps = setInterval(() => {
        step = -step
        void active.effect.setPitch(step, $('formants').checked)
      }, Number($('interval').value))
    }
    updateUI()
    describe()
  } catch (error) { await stop(`Engine error: ${error.message}`) }
}

async function connect() {
  if (connecting || checking || session) return
  if (!navigator.mediaDevices?.getDisplayMedia) {
    $('status').textContent = 'Open this localhost page in Chrome to share tab audio.'
    return
  }
  connecting = true
  const token = ++generation
  updateUI()
  $('status').textContent = 'Choose a playing Chrome tab and enable Share tab audio.'
  let stream, context, source, effect
  let loadingTimeout
  try {
    const capture = navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: 'browser' },
      audio: { suppressLocalAudioPlayback: true, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      selfBrowserSurface: 'exclude', systemAudio: 'exclude',
      surfaceSwitching: 'exclude', monitorTypeSurfaces: 'exclude'
    })
    // Attach a handler immediately, even if AudioContext construction fails.
    capture.then(value => {
      stream = value
      if (token !== generation) stream.getTracks().forEach(track => track.stop())
    }, () => {})
    context = new AudioContext({ latencyHint: 'interactive' })
    // Wait for both outcomes so a later capture success cannot leak a stream
    // when resume fails. Both calls occur within the user's click gesture.
    const outcomes = await Promise.allSettled([capture, context.resume()])
    for (const outcome of outcomes) if (outcome.status === 'rejected') throw outcome.reason
    if (token !== generation) throw new Error('Connection cancelled.')
    if (!stream.getAudioTracks().length) throw new Error('No audio shared. Choose a Chrome tab and enable Share tab audio.')
    const surface = stream.getVideoTracks()[0]?.getSettings().displaySurface
    if (surface && surface !== 'browser') throw new Error('Choose a browser tab so only that tab’s audio is processed.')
    $('status').textContent = 'Loading the pitch engine…'
    effect = await Promise.race([
      createComparison(context, $('profile').value),
      new Promise((_, reject) => { loadingTimeout = setTimeout(() => reject(new Error('Engine initialization timed out.')), 10000) })
    ])
    clearTimeout(loadingTimeout)
    if (token !== generation || stream.getAudioTracks()[0].readyState !== 'live') throw new Error('Sharing ended before the engine was ready.')
    source = context.createMediaStreamSource(stream)
    const analyser = context.createAnalyser()
    analyser.fftSize = 2048
    source.connect(effect.input)
    effect.output.connect(analyser).connect(context.destination)
    const samples = new Float32Array(analyser.fftSize)
    const active = { stream, context, source, effect, steps: null, meter: null }
    session = active
    mode = 'original'
    effect.node.onprocessorerror = () => { if (session === active) void stop('The pitch engine stopped. Normal tab playback has been restored.') }
    stream.getTracks().forEach(track => {
      track.onended = () => { if (session === active) void stop('Tab sharing ended. Connect again to listen.') }
    })
    active.meter = setInterval(() => {
      analyser.getFloatTimeDomainData(samples)
      let peak = 0
      for (const sample of samples) peak = Math.max(peak, Math.abs(sample))
      $('meter').textContent = peak < 0.0001 ? 'No audio reaching the output. Check that the source tab is playing.'
        : `Output peak: ${(20 * Math.log10(peak)).toFixed(1)} dBFS${peak > 1 ? ' · clipping: reduce source volume' : ''} · Same volume and delay on both paths.`
    }, 250)
    describe()
  } catch (error) {
    if (token === generation) ++generation
    stream?.getTracks().forEach(track => track.stop())
    source?.disconnect()
    effect?.dispose()
    if (context && context.state !== 'closed') await context.close()
    $('status').textContent = error.name === 'NotAllowedError' ? 'Sharing cancelled or blocked. Connect again and select a Chrome tab with audio sharing enabled.' : error.message
  } finally {
    clearTimeout(loadingTimeout)
    connecting = false
    updateUI()
  }
}

$('connect').onclick = connect
$('stop').onclick = () => void stop()
for (const button of document.querySelectorAll('[data-mode]')) button.onclick = () => void selectMode(button.dataset.mode)
for (const id of ['formants', 'interval']) $(id).onchange = () => void selectMode(mode)
document.addEventListener('visibilitychange', () => {
  if (document.hidden && mode === 'steps') void selectMode('unity')
})
window.addEventListener('pagehide', () => { void stop() })
window.runPitchEngineChecks = runSignalChecks
$('check').onclick = async () => {
  checking = true
  updateUI()
  $('checks').textContent = 'Checking…'
  try { $('checks').textContent = JSON.stringify(await runSignalChecks(), null, 2) }
  catch (error) { $('checks').textContent = error.stack }
  finally { checking = false; updateUI() }
}
