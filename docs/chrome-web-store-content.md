# Chrome Web Store Content for Browser FX

**Current version: 0.4.0**

The canonical listing copy lives in `docs/store-description.txt`. Paste that file
into the store's Detailed Description field. This document holds everything
else the listing form asks for, plus the counts that have to stay in sync.

> **Do not paste keyword lists into the listing.** The 0.3.0 submission was
> rejected for Keyword Spam (ref: Yellow Argon) because the Detailed Description
> contained all 23 effect names as a `•`-separated run. The effect and preset
> lists below are internal reference only. In the listing itself, describe what
> the effects do in prose. Same rule for the manifest `description` in
> `package.json` and the store's Short Description field.

## Facts to keep in sync

Update these everywhere when they change: `docs/store-description.txt`, the
`description` field in `package.json`, and the About panel in the popup.

| | Current |
|---|---|
| Effects | 24 |
| Factory presets | 8 |
| Max chain length | 4 |

Effects: Bitcrusher, Auto Tune, CD Skipper, Reverb, Hall Reverb, Filter, Auto Filter,
Comb Filter, Delay, Tap Delay, Distortion, Chorus, Phaser, Flanger, Tremolo,
Vibrato, Auto Panner, Pitch Shifter, Ring Mod, Compressor, DJ EQ, Tape Stop,
Lo-Fi Tape, Utility

Presets: Lo-Fi Radio, Chopped & Screwed, Wobbler, Warped Record, Jet Stream,
Dub Echo, Mono, Cyborg

## Short Description (132 characters max)

**Current: 117 characters**
```
Real-time audio effects, including Auto Tune, for any browser tab. Chain up to 4 effects, use MIDI, and save presets.
```

## What's New in 0.4.0

Short changelog for the store's update notes.

```
• New Auto Tune effect: snap solo vocals to a musical key and scale.
• Four controls: Key, Scale, Retune, and Mix. Choose chromatic, major, minor,
  or pentatonic scales, with fast snapping or slower pitch glides.
• Find Auto Tune directly below Bitcrusher in the effect selector. Use it in
  your effect chains, saved presets, and MIDI mappings.
• Browser FX now includes 24 effects. All audio processing stays on your device.
```

Release build: `npm ci && npm run release`. Upload `build/chrome-mv3-prod.zip`.
The submission workflow remains manually triggered; running the local release
command only tests, builds, and packages the extension. The prepared upload bundle
is in `build/release-0.4.0/`, with the versioned ZIP, release notes, detailed store
description, and SHA-256 checksums. Nothing has been submitted.

Release validation: all 16 Auto Tune tests and the Chrome integration checks pass.
The ZIP contains the generated worklet and third-party notices, and requests the
same permissions as 0.3.0. Chrome 116 is now declared as the minimum version to
match the existing service-worker-to-offscreen capture path. The repository-wide
TypeScript check still reports the 22 pre-existing errors reproduced on the base
commit; production bundling succeeds. Screenshots and promotional tiles have not
been refreshed for this release.

## Category

**Primary**: Productivity
**Secondary**: Tools

## Permission Justifications

### activeTab
```
Grants temporary access to the currently active tab only when the user clicks the extension icon, enabling reliable tab audio capture across any webpage (including non-HTTPS pages) without broadening background access.
```

### tabCapture
```
Required to capture audio streams from browser tabs for real-time audio effects processing. This permission is essential for the core functionality of applying audio effects to tab audio content.
```

### offscreen
```
Needed to create an offscreen document for Web Audio API processing. Chrome Manifest V3 service workers cannot host an AudioContext, so audio processing runs in an offscreen document instead.
```

### storage
```
Required to save user preferences, effect chains, saved presets, and MIDI mappings. This allows the extension to remember which effects and parameters users prefer for different websites, providing a personalized experience.
```

### host_permissions ("https://*/*")
```
Necessary to access and process audio from any HTTPS website. This broad permission enables the extension to work with all streaming services, video platforms, and websites with audio content while maintaining security through HTTPS-only access.
```

## Store Listing Metadata

### Developer Name
```
Bruce Blay
```

### Support Email
```
bruceblay@gmail.com
```

### Website/Homepage
```
https://github.com/bruceblay/tab-bitcrusher
```

### Support URL (optional)
```
https://github.com/bruceblay/tab-bitcrusher/issues
```

## Screenshot Descriptions

### Screenshot 1: Main Interface
```
"Browser FX with a single effect loaded, showing the studio-style knobs, the effect selector, and the power LED."
```

### Screenshot 2: Effect Chain
```
"A four-effect chain running in series, with drag handles for reordering and a bypass LED on each slot."
```

### Screenshot 3: Presets
```
"The preset menu, showing the eight built-in presets alongside the user's own saved chains."
```

### Screenshot 4: MIDI Learn
```
"MIDI learn mode active, with a knob armed and waiting for a controller to send a CC."
```

### Screenshot 5: Visualizer
```
"The audio-reactive cymatic visualizer, a Chladni plate pattern driven by the tab's audio."
```

## Promotional Content

### Single Purpose Statement
```
Browser FX applies real-time audio effects to browser tab audio content.
```

### Key Benefits (for promotional materials)
```
• 24 audio effects, chainable up to 4 at a time
• Auto Tune for musical vocal pitch correction, from hard snapping to smooth glides
• Real-time processing, all local
• Per-tab effect management
• Hardware MIDI control with one-click learn
• Eight built-in presets, plus your own
• No registration required
• Complete privacy, no external servers
```

## Store Listing Tips

### Search Keywords (internal reference)
```
audio effects, real-time audio, browser audio, sound effects, audio processing, music enhancement, audio filter, chrome audio, web audio, streaming audio, audio tools, sound processing, midi controller, mono audio, stereo width
```

### Target Audience
```
Primary: Music enthusiasts, content creators, audio hobbyists
Secondary: Students, developers, general users who consume web audio
```

### Competitive Advantages
```
• Most comprehensive set of audio effects for browsers
• Effect chaining with drag-to-reorder, uncommon in browser audio extensions
• Hardware MIDI control, effectively unique in this category
• Per-tab functionality
• No external dependencies or accounts required
• Open source and privacy-focused
```

---

## Pre-Upload Checklist

- [x] Bump `version` in `package.json` and `package-lock.json` to 0.4.0
- [x] Production build and all 16 Auto Tune tests pass
- [x] Package and verify `build/release-0.4.0/browser-fx-0.4.0.zip`
- [x] Chrome checks: packaged worklet, chain, live controls, slot/master bypass
- [x] Verify worklet and license notices are included
- [ ] Refresh screenshots if the UI changed (1280x800 or 640x400)
- [ ] Design promo tiles (440x280 and marquee)
- [ ] Paste `docs/store-description.txt` into Detailed Description
- [ ] Paste the What's New block into the update notes
- [x] Confirm permissions match the previous release (no new permissions)
- [ ] Select category: Productivity
- [ ] Set visibility: Public
- [ ] Submit for review

Review timing is determined by the Chrome Web Store.
