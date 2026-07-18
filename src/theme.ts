// Shared design tokens, modeled on Ableton Live / Max for Live device styling

export const theme = {
  // Surfaces
  bg: '#0d0d0d',            // window background behind the device panel
  panel: '#1e1e1e',         // device body
  titleBar: '#3a3a3a',      // device title strip
  titleBarGradient: 'linear-gradient(#424242, #353535)',
  control: '#282828',       // selects, buttons
  controlBorder: '#111111',
  panelBorder: '#0a0a0a',

  // Knobs
  cream: '#f0ecdc',         // classic Live knob face
  knobIndicator: '#2b2b2b',
  knobTrack: '#111111',     // unfilled arc

  // Text
  text: '#d6d6d6',
  textBright: '#ececec',
  textDim: '#9a9a9a',
  textFaint: '#6c6c6c',

  // Accents
  led: '#44d962',           // device activator green
  ledGlow: 'rgba(68, 217, 98, 0.55)',

  font: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  mono: '"Inter", monospace'
}
