import { createSlice, PayloadAction } from "@reduxjs/toolkit"

export interface Mod {
  id: string
  name: string
  file: string
  image: string
  description: string
  enabled?: boolean
  dependsOn?: string[]
  conflictWith?: string[]
}

export interface Preset {
  id: string
  name: string
  description: string
  mods: string[] | string
}

interface ModState {
  mods: Mod[]
  presets: Preset[]
  activePresetId: string | null
  presetStates: Record<string, Record<string, boolean>>
}

const initialState: ModState = {
  mods: [],
  presets: [],
  activePresetId: "all",
  presetStates: {},
}

const modsSlice = createSlice({
    name: 'modsState',
    initialState,
    reducers: {
        savePresetState: (state, action: PayloadAction<{ presetId: string; modId: string; enabled: boolean }>) => {
          const { presetId, modId, enabled } = action.payload
          if (!state.presetStates[presetId]) state.presetStates[presetId] = {}
          state.presetStates[presetId][modId] = enabled
        },

        resetPresetState: (state, action: PayloadAction<string>) => {
          delete state.presetStates[action.payload]
        },
        setModsData: (state, action: PayloadAction<{ mods: Mod[]; presets: Preset[] }>) => {
            state.mods = action.payload.mods;
            state.presets = action.payload.presets
        },
        toggleMod: (state, action: PayloadAction<string>) => {
            const mod = state.mods.find((m) => m.id === action.payload)
            if (mod) mod.enabled = !mod.enabled
        },
        setModEnabled: (state, action: PayloadAction<{ id: string; enabled: boolean }>) => {
          const mod = state.mods.find((m) => m.id === action.payload.id)
          if (mod) mod.enabled = action.payload.enabled
        },
        applyPreset: (state, action: PayloadAction<string>) => {
          const preset = state.presets.find((p) => p.id === action.payload)
          if (preset) {
            const isAll = preset.mods === "all"
            state.mods.forEach((mod) => {
              mod.enabled = isAll || preset.mods.includes(mod.id)
            })
            state.activePresetId = preset.id
          }
        },
        // applyPreset: (state, action: PayloadAction<string>) => {
        //   const presetId = action.payload
        //   const preset = state.presets.find(p => p.id === presetId)
        //   if (!preset) return

        //   const savedStates = state.presetStates[presetId]
        //   const isAll = preset.mods === "all"

        //   state.mods.forEach((mod) => {
        //     if (isAll) {
        //       mod.enabled = savedStates?.[mod.id] ?? true
        //     } else {
        //       mod.enabled = preset.mods.includes(mod.id) 
        //         ? savedStates?.[mod.id] ?? true 
        //         : false
        //     }
        //   }) 
        //   state.activePresetId = presetId
        // },
        saveFullPresetState: (state, action: PayloadAction<{ presetId: string; mods: { id: string; enabled: boolean }[] }>) => {
          const { presetId, mods } = action.payload
          if (!state.presetStates[presetId]) state.presetStates[presetId] = {}

          mods.forEach(({ id, enabled }) => {
            state.presetStates[presetId][id] = enabled
          })
        },

        setActivePreset: (state, action: PayloadAction<string | null>) => {
          state.activePresetId = action.payload
        }
    }
})

export const { setModsData, saveFullPresetState, setModEnabled, setActivePreset, toggleMod, applyPreset } = modsSlice.actions
export default modsSlice.reducer