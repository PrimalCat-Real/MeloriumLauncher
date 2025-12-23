import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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

interface ModsState {
  mods: Mod[]
  missingMods: Mod[]
  presets: Preset[]
  activePresetId: string
}

interface ModsActions {
  setModsData: (mods: Mod[], presets: Preset[]) => void
  setActivePreset: (presetId: string) => void
  toggleMod: (modId: string) => void
  resetMods: () => void
}

type ModsStore = ModsState & ModsActions

export const useModsStore = create<ModsStore>()(
  persist(
    (set, get) => ({
      mods: [],
      missingMods: [],
      presets: [],
      activePresetId: "all",
      setModsData: (newMods, newPresets) => {
        set((state) => {
          const presets = newPresets || []
          const mergedMods = newMods.map((srvMod) => {
            const existing = state.mods.find((m) => m.id === srvMod.id)
            return {
              ...srvMod,
              enabled: existing ? existing.enabled : true 
            }
          })

          return {
            mods: mergedMods,
            presets: presets,
            activePresetId: presets.find(p => p.id === state.activePresetId) || state.activePresetId === 'all' || state.activePresetId === 'custom' 
              ? state.activePresetId 
              : 'all'
          }
        })
      },


      setActivePreset: (presetId) => {
        set((state) => {
          let updatedMods = [...state.mods]

          if (presetId === 'all') {
            updatedMods = updatedMods.map(m => ({ ...m, enabled: true }))
          } else {
            const targetPreset = state.presets.find(p => p.id === presetId)
            
            if (targetPreset) {
              const presetModIds = Array.isArray(targetPreset.mods) 
                ? targetPreset.mods 
                : [targetPreset.mods]

              updatedMods = updatedMods.map(m => ({
                ...m,
                enabled: presetModIds.includes(m.id)
              }))
            }
          }

          return {
            activePresetId: presetId,
            mods: updatedMods
          }
        })
      },

      toggleMod: (modId) => {
        set((state) => {
          const updatedMods = state.mods.map((mod) => 
            mod.id === modId ? { ...mod, enabled: !mod.enabled } : mod
          )
          
          return {
            mods: updatedMods,
            activePresetId: 'custom'
          }
        })
      },

      resetMods: () => {
        set({ mods: [], presets: [], activePresetId: 'all' })
      }
    }),
    {
      name: "mods-storage",
    }
  )
)