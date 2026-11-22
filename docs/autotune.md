# Auto Tune

Implemented on `codex/autotune` using the Signalsmith pitch engine accepted in the YouTube listening comparison. The original grain-based synthesis has been replaced. Auto Tune is registered in the normal effect selector and uses the same four-parameter, preset, live-update, and MIDI conventions as the other effects.

## Listening

Reload the unpacked extension from `build/chrome-mv3-prod` (or the rebuilt development directory) and add **Auto Tune**. Set Key to match the music. A solo voice is the best input; this effect does not isolate a singer from accompaniment.

For an obvious effect, start with **Minor Pentatonic, Retune 0 ms, Mix 100%**. Major and natural minor retain more notes; chromatic gives smaller corrections. Higher Retune values produce slower glides.

The same production effect can be tried directly on a YouTube tab in Chrome, without uploading a file:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Open [the Auto Tune listening page](http://127.0.0.1:8765/tests/autotune-browser.html), connect a playing tab, and enable **Share tab audio**. The page shows detected note → target note, correction amount, and tracking confidence. Its Original toggle retains the same buffering delay. Stop restores normal source-tab playback. The [fixed-shift comparison](http://127.0.0.1:8765/tests/pitch-engine.html) remains available as a baseline.

## Controls

| Knob | Range | Behavior |
| --- | --- | --- |
| Key | C–B | Root of the selected scale; ignored in Chromatic mode. |
| Scale | Chromatic, Major, Minor, Major Pentatonic, Minor Pentatonic | Allowed notes. Default: C Major. |
| Retune | 0–300 ms | 0 gives immediate controller snapping; higher values smooth the correction. Default: 0 ms. The spectral engine still has a finite transition window. |
| Mix | 0–100% | Original/corrected blend, with aligned delay. Default: 100%. |

Partial Mix intentionally combines two pitches when correction is active. Place Auto Tune before distortion, chorus, delay, or reverb so the detector receives a clear voice.

## DSP and integration

- `src/audio/autotune-worklet.mjs` runs detection, correction control, formant-preserving synthesis, and mixing on the audio rendering thread. Popup/main-thread timers do not drive the correction loop.
- Pitchy 4.1.0 supplies the McLeod pitch detector. Analysis uses filtered, decimated audio at roughly 12 kHz, a 512-sample frame, and a 5 ms hop. Synthesis receives full-band stereo audio. DC is removed only from analysis; right-only and opposite-polarity stereo inputs remain detectable.
- `src/audio/pitch-controller.mjs` selects a nearby allowed note, uses a three-frame median and 12-cent boundary hysteresis, holds brief uncertain detections for 25 ms, and releases unvoiced audio. A 1.5-cent deadband avoids needless processing of already tuned notes. Retune smooths the correction in semitones.
- Signalsmith Stretch 1.3.2 supplies the unmodified WASM DSP. The production setting uses an 80 ms window and 10 ms interval, with split computation enabled: **90 ms engine delay per instance**, plus tab capture/device latency. This is a compromise between the audition's 120 ms and 60 ms windows, not a claim of instantaneous hard tuning.
- Detector results are stamped at the analysis frame's source-time centre. Correction is looked up at the engine's input-latency offset; output voicing uses total latency. Formant compensation receives the corresponding fundamental estimate.
- Dry mix, slot bypass, master bypass, and error fallback retain the engine delay. Chains with multiple instances accumulate their delays. Chain changes warm up the new graph before fading out the old graph.
- Each instance owns its WASM state. Before initialization, the processor returns delayed original audio. Initialization failure or a worklet error falls back to delayed original audio with a console error. Disposal closes the port and releases the graph.

## Build and licensing

```sh
npm run build
npm run test:autotune
```

`prebuild` and `predev` run `scripts/build-autotune.js`. It verifies the pinned Signalsmith browser release's SHA-256, retains its Emscripten factory and embedded WASM, replaces only the scheduling wrapper, and bundles Pitchy plus our controller with esbuild. Edit `src/audio/`, not generated `autotune-worklet.js`.

Both offscreen copy scripts package the generated worklet and `autotune-licenses.txt`. The manifest permits local WASM using `script-src 'self' 'wasm-unsafe-eval'`. All executable code is packaged locally; there is no CDN, service, audio upload, or model download.

For worklet edits during an already-running development session, run `npm run build:autotune` and `npm run copy-offscreen:dev`, then reload the extension. The generated worklet does not use Plasmo's hot-reload path.

Notices cover Signalsmith Stretch, Signalsmith Linear, Pitchy, and fft.js. The pinned Pitchy npm package contains an MIT license even though the current upstream README describes a different license; the distributed package's actual license is included.

## Validation and remaining limits

Recorded 2026-11-05:

- Production and development builds generated successfully, with the WASM policy, worklet, and notices present.
- All 16 signal/controller tests pass using the actual bundled WASM with a minimal AudioWorklet host. Coverage includes 44.1/48/96 kHz, note selection, pentatonic glides becoming discrete allowed notes, vibrato suppression, live key/scale changes, retune response, stereo polarity, a strong second harmonic, unvoiced transitions, dry alignment, Mix, and disposal.
- Chrome OfflineAudioContext checks exercise the packaged worklet through Auto Tune + Utility, slot/master bypass, live changes, and cleanup. The page uses a restricted script policy without inline scripts or Blob worklets.
- A ten-second muted real-time Chrome check at 44.1 kHz passed a generated vocal-like signal through a MediaStream source and the production effect while changing Scale, Retune, and Mix. All 100 analyser readings were finite, with no zero readings after startup. This is an integration check, not proof of perceptual quality on a real singer.
- The synthetic listening demo renders successfully, with its 90 ms delay trimmed.

**Known precision limitation:** the accepted Signalsmith release can land several cents off its requested pitch. The original engine benchmark still reports failures against its 5-cent precision requirement; it has not been relabelled a pass. Current effect-routing tests allow 20 cents when checking the selected note, while controller tests check exact scale membership and snapping. This consciously prioritizes the musical effect and accepted texture; it does not resolve or disguise the upstream frequency bias. Do not compensate with a constant offset: the bias depends on note, shift, configuration, and sample rate.

The user tested automatic tuning in the extension and accepted it for this release. At Retune 0 ms and Mix 100%, the effect was audible and recognizable as Auto Tune, although stronger tuning remains a possible future improvement. Breathy vocals, overlapping voices, and full music mixes can still confuse monophonic tracking. The effect does not separate stems or determine the song's key.

The repository-wide TypeScript check previously reported 22 pre-existing errors, reproduced on the base commit. Production bundling succeeds; those unrelated errors have not been changed here.

## References

- [Signalsmith Stretch and its latency/automation model](https://github.com/Signalsmith-Audio/signalsmith-stretch).
- [Official browser/WASM API](https://github.com/Signalsmith-Audio/signalsmith-stretch/blob/main/web/release/README.md).
- [Upstream pitch-accuracy report](https://github.com/Signalsmith-Audio/signalsmith-stretch/issues/31).
- [Pitchy detector](https://github.com/ianprime0509/pitchy).
- [Chrome extension WASM policy](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy).
