// Core types for the effect system

export interface ParameterConfig {
  key: string
  label: string
  min: number
  max: number
  step: number
  default: number
  unit?: string
}

export interface EffectConfig {
  id: string
  name: string
  description: string
  parameters: ParameterConfig[]
  defaultValues: Record<string, number>
  sliderColor: string
}

export interface EffectState {
  selectedEffect: string
  isCapturing: boolean
  effectParameters: Record<string, Record<string, number>>
}

// Message types for communication with offscreen document
export interface UpdateEffectMessage {
  type: "UPDATE_EFFECT_PARAMS"
  effectId: string
  params: Record<string, number>
}

export interface SwitchEffectMessage {
  type: "SWITCH_EFFECT"
  effectId: string
  params: Record<string, number>
}