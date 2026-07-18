// One-time MIDI permission grant page. Once the user accepts here, the
// permission sticks to the extension origin and the popup and offscreen
// document can call requestMIDIAccess without any prompt.

const statusEl = document.getElementById('status')
const activityEl = document.getElementById('activity')

function showDevices(access) {
  const names = []
  access.inputs.forEach((input) => names.push(input.name || 'unnamed device'))
  statusEl.className = 'visible ok'
  statusEl.textContent = names.length
    ? `MIDI enabled. Connected inputs:\n${names.join('\n')}\n\nYou can close this tab. Use the M button in the popup to map knobs.`
    : 'MIDI enabled, but no controllers are connected. Plug one in, then use the M button in the popup to map knobs.'

  // Show live CC activity so the user can confirm their controller talks
  access.inputs.forEach((input) => {
    input.onmidimessage = (msg) => {
      const [statusByte, data1, data2] = msg.data
      if ((statusByte & 0xf0) === 0xb0) {
        activityEl.className = 'visible'
        activityEl.textContent = `receiving: CC ${data1} = ${data2}`
      }
    }
  })
  access.onstatechange = () => showDevices(access)
}

document.getElementById('enable').addEventListener('click', async () => {
  statusEl.className = 'visible'
  statusEl.textContent = 'requesting access...'
  try {
    const access = await navigator.requestMIDIAccess({ sysex: false })
    showDevices(access)
  } catch (err) {
    statusEl.className = 'visible err'
    statusEl.textContent = `MIDI access was denied or unavailable: ${err.message}`
  }
})
