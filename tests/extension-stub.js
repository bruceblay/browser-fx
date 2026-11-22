// Only extension messaging is stubbed; the effect graph and worklet are real.
window.chrome = { runtime: {
  getURL: name => new URL('../' + name, location.href).href,
  onMessage: { addListener() {} }, sendMessage() {}
} }
