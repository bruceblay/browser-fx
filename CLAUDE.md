# Tab Bitcrusher - Claude Context

## Project Overview
Chrome extension that applies real-time bitcrusher audio effects to browser tab audio using Web Audio API.

## Architecture
- **Plasmo Framework**: Chrome MV3 extension builder
- **Popup (React)**: UI controls, initiates tab capture via Chrome 116+ getMediaStreamId()
- **Background Script**: Service worker that manages offscreen documents and forwards messages
- **Offscreen Document**: Handles Web Audio processing (required for AudioContext in MV3)

## Critical Files & Functions
- `popup.tsx`: Tab capture via `chrome.tabCapture.getMediaStreamId()` - MUST be called from popup (user gesture required)
- `background.ts`: Message forwarding between popup and offscreen
- `offscreen-simple.js`: Web Audio processing with dynamic bitcrusher
- `offscreen.html`: Loads offscreen-simple.js

## Build System
- `npm run dev`: Plasmo dev + auto-copy offscreen files
- `scripts/copy-offscreen.js`: Copies offscreen files to build dir (offscreen files not handled by Plasmo)

## Known Working State
- Tab capture: Works via popup with Chrome 116+ API
- Audio routing: popup → background → offscreen → Web Audio processing
- Effect: Bitcrusher with dynamic bit depth and wet/dry mix
- UI: React sliders that send UPDATE_EFFECT_PARAMS messages

## Debug Commands
- `npm run copy-offscreen`: Manual file copy
- Check browser console for "🎵" prefixed logs from offscreen document

## Critical Rules
1. NEVER break working audio processing when making changes
2. Test audio functionality after ANY change to offscreen files
3. Always verify offscreen files are copied to build directory
4. Message flow: popup → background → offscreen (all async)
5. Offscreen document must exist before sending messages to it

## Last Known Working Configuration
- Dynamic bitcrusher parameters working
- Real-time slider control implemented
- Build script automation added
- All three components (popup, background, offscreen) communicating properly