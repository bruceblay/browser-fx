# Chrome Web Store Content for Browser FX

**Current version: 0.3.0**

The canonical listing copy lives in `docs/store-description.txt`. Paste that file
into the store's Detailed Description field. This document holds everything
else the listing form asks for, plus the counts that have to stay in sync.

## Facts to keep in sync

Update these everywhere when they change: `docs/store-description.txt`, the
`description` field in `package.json`, and the About panel in the popup.

| | Current |
|---|---|
| Effects | 23 |
| Factory presets | 8 |
| Max chain length | 4 |

Effects: Bitcrusher, CD Skipper, Reverb, Hall Reverb, Filter, Auto Filter,
Comb Filter, Delay, Tap Delay, Distortion, Chorus, Phaser, Flanger, Tremolo,
Vibrato, Auto Panner, Pitch Shifter, Ring Mod, Compressor, DJ EQ, Tape Stop,
Lo-Fi Tape, Utility

Presets: Lo-Fi Radio, Chopped & Screwed, Wobbler, Warped Record, Jet Stream,
Dub Echo, Mono, Cyborg

## Short Description (132 characters max)

**Current: 108 characters**
```
Real-time audio effects for any browser tab. Chain up to 4, control them with MIDI, save your own presets.
```

## What's New in 0.3.0

Short changelog for the store's update notes.

```
• New Utility effect: gain, pan, and stereo width on three knobs. Turn Width
  fully down to sum any tab to mono.
• New Mono preset, one click to a mono-summed tab.
• Lower latency. Processed audio now goes straight to your speakers instead of
  through an extra playback stage.
• Switching effects off and back on no longer drops the audio for a moment.
```

## Category

**Primary**: Productivity
**Secondary**: Tools

## Permission Justifications

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
• 23 audio effects, chainable up to 4 at a time
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

- [ ] Bump `version` in `package.json`
- [ ] `npm run build`
- [ ] Zip the *contents* of `build/chrome-mv3-prod`
- [ ] Refresh screenshots if the UI changed (1280x800 or 640x400)
- [ ] Design promo tiles (440x280 and marquee)
- [ ] Paste `docs/store-description.txt` into Detailed Description
- [ ] Paste the What's New block into the update notes
- [ ] Confirm permission justifications still match `package.json` manifest
- [ ] Select category: Productivity
- [ ] Set visibility: Public
- [ ] Submit for review

**Estimated Review Time**: 24-48 hours
