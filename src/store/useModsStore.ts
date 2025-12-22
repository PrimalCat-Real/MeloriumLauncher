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


export interface ModsState {
    mods: Mod[]
    missingMods: Mod[]
    presets: Preset[]
    activePresetId: string
}


const useModsStore = create<ModsState>()(
    persist((set) => ({
        mods: [],
        missingMods: [],
        presets: [],
        activePresetId: "all",
    }),
    {
        name: "mods-storage"
    }
    )
)