# New Effects Roadmap

## Overview
Plan to expand Tab Bitcrusher from a single-effect extension to a multi-effect audio processor. Users will select one effect at a time from a dropdown, with dynamic controls that change based on the selected effect.

## UI Design

### Layout Structure
```
┌─────────────────────────────────────┐
│          Tab Bitcrusher             │
├─────────────────────────────────────┤
│ Status: Ready                       │
│                                     │
│ Effect: [Bitcrusher ▼]              │
│                                     │
│ ┌─ Dynamic Controls Section ──────┐ │
│ │ [Parameters specific to effect] │ │
│ │ • Bitcrusher: bits, sample, wet │ │
│ │ • Reverb: room, decay, wet      │ │
│ │ • Distortion: amount, tone      │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [Capture Tab Audio]                 │
│ [🧹 Clear All Streams (Debug)]      │
└─────────────────────────────────────┘
```

### Key Changes
1. **Effect Selector**: Dropdown at top to choose active effect
2. **Dynamic Controls**: Parameter section changes based on selection
3. **State Management**: Save selected effect and parameters
4. **Single Effect Mode**: Only one effect active at a time (for now)

## Planned Effects

### Phase 1: Core Audio Effects (Tone.js)
- **Bitcrusher** ✅ (Current)
- **Reverb** - Room size, decay time, wet/dry
- **Distortion** - Amount, tone, wet/dry
- **Chorus** - Rate, depth, delay, wet/dry
- **Phaser** - Rate, depth, stages, wet/dry
- **AutoWah** - Sensitivity, base frequency, octaves

### Phase 2: Creative Effects
- **PingPongDelay** - Delay time, feedback, wet/dry
- **Tremolo** - Rate, depth
- **Vibrato** - Rate, depth
- **AutoFilter** - Base frequency, octaves, sensitivity
- **FeedbackDelay** - Delay time, feedback, wet/dry
- **Freeverb** - Room size, dampening, wet/dry

### Phase 3: Advanced Effects (Tuna.js integration)
- **Cabinet** - Cabinet simulation models
- **Convolver** - Impulse response reverb
- **Filter** - High-pass, low-pass, band-pass
- **Compressor** - Threshold, ratio, attack, release
- **Overdrive** - Drive, color, wet/dry
- **WahWah** - Auto wah with envelope following

## Technical Implementation

### 1. Effect Selection System
```typescript
interface EffectConfig {
  id: string
  name: string
  parameters: ParameterConfig[]
  defaultValues: Record<string, number>
}

interface ParameterConfig {
  key: string
  label: string
  min: number
  max: number
  step: number
  default: number
  unit?: string
}
```

### 2. State Management
```typescript
interface ExtensionState {
  selectedEffect: string
  isCapturing: boolean
  effectParameters: Record<string, Record<string, number>>
  // e.g., { "bitcrusher": { bits: 8, wet: 0.5 }, "reverb": { room: 0.7 } }
}
```

### 3. Dynamic Control Rendering
- Single component that renders different parameter controls based on selected effect
- Each effect has its own parameter configuration
- Controls automatically update when effect selection changes

### 4. Audio Processing Changes
- Replace single bitcrusher with effect factory pattern
- Create/destroy effects based on selection
- Pass parameters to active effect only

## Migration Strategy

### Step 1: Refactor Current Implementation
1. Extract bitcrusher into effect configuration object
2. Create dynamic controls component
3. Add effect selector dropdown (initially with just Bitcrusher)

### Step 2: Add Basic Effects
1. Implement 2-3 simple effects (Reverb, Distortion)
2. Test effect switching functionality
3. Ensure audio routing works correctly

### Step 3: Expand Effect Library
1. Add remaining Tone.js effects
2. Create more sophisticated parameter mappings
3. Add effect presets/favorites

### Step 4: Advanced Features
1. Effect chaining (multiple effects)
2. User presets save/load
3. Real-time spectrum analyzer
4. MIDI control integration

## File Structure Changes

```
src/
├── effects/
│   ├── index.ts              # Effect registry
│   ├── bitcrusher.ts         # Bitcrusher config
│   ├── reverb.ts             # Reverb config
│   ├── distortion.ts         # Distortion config
│   └── types.ts              # Effect interfaces
├── components/
│   ├── EffectSelector.tsx    # Dropdown component
│   ├── DynamicControls.tsx   # Parameter controls
│   └── AudioControls.tsx     # Capture/stop buttons
├── offscreen-effects.js      # New multi-effect processor
└── popup.tsx                 # Main UI orchestration
```

## Benefits
- **User Experience**: More creative possibilities with multiple effects
- **Extensibility**: Easy to add new effects without UI changes
- **Performance**: Only one effect active at a time (efficient)
- **Maintainability**: Clean separation between effects and UI

## Considerations
- **Audio Latency**: Ensure effect switching doesn't cause audio dropouts
- **Memory Usage**: Properly dispose of unused effect instances
- **UI Complexity**: Keep interface simple despite more options
- **State Persistence**: Save user preferences across sessions
- **Testing**: Each effect needs individual parameter testing

## Future Enhancements
- Effect presets and sharing
- Visual audio feedback (waveforms, spectrum)
- Effect chaining/routing
- Real-time performance mode with MIDI/keyboard control
- Recording/bouncing processed audio
- Integration with popular streaming/recording software