import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit"
import { invoke } from "@tauri-apps/api/core"
import path from "path"
import { RootState } from "@/store/configureStore"
import { getParents } from "@/lib/utils"

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
  missingMods: Mod[]
  presets: Preset[]
  activePresetId: string | null
  presetStates: Record<string, Record<string, boolean>>
  isApplyingPreset: boolean
}

const initialState: ModState = {
  mods: [],
  presets: [],
  activePresetId: "all",
  presetStates: {},
  missingMods: [],
  isApplyingPreset: false,
}

const buildTarget = (preset: Preset, allMods: Mod[]): Record<string, boolean> => {
  const target: Record<string, boolean> = {}
  if (preset.mods === "all") {
    for (const m of allMods) target[m.id] = true
  } else {
    const set = new Set(preset.mods)
    for (const m of allMods) target[m.id] = set.has(m.id)
  }
  // гарантируем родителей
  for (const m of allMods) {
    if (!target[m.id]) continue
    const parents = getParents(m.id, allMods)
    for (const p of parents) target[p] = true
  }
  // конфликты: если оба true и только один в пресете — оставляем пресетный
  if (preset.mods !== "all") {
    const inPreset = new Set(preset.mods as string[])
    for (const m of allMods) {
      if (!m.conflictWith?.length) continue
      for (const c of m.conflictWith) {
        if (!target[m.id] || !target[c]) continue
        const mIn = inPreset.has(m.id)
        const cIn = inPreset.has(c)
        if (mIn && !cIn) target[c] = false
        if (cIn && !mIn) target[m.id] = false
      }
    }
  }
  return target
}

export const applyPresetOnce = createAsyncThunk<
  { changed: Array<{ id: string; enabled: boolean }> },
  string,
  { state: RootState }
>(
  "modsState/applyPresetOnce",
  async (presetId, { getState, dispatch, rejectWithValue }) => {
    try {
      const state = getState()
      const { mods, presets, missingMods } = state.modsSlice
      const baseDir = state.downloadSlice.gameDir
      const modsDir = path.join(baseDir || "", "Melorium", "mods")

      const preset = presets.find(p => p.id === presetId)
      if (!preset) return { changed: [] }

      const target = buildTarget(preset, mods)

      // недостающие моды нельзя включить
      const missingSet = new Set(missingMods.map(m => m.id))
      for (const id of Object.keys(target)) {
        if (target[id] && missingSet.has(id)) target[id] = false
      }

      const toDisable: Array<{ id: string; filePath: string }> = []
      const toEnable: Array<{ id: string; filePath: string }> = []

      for (const m of mods) {
        const desired = !!target[m.id]
        const cur = !!m.enabled
        if (desired === cur) continue
        const filePath = path.join(modsDir, m.file)
        if (desired) toEnable.push({ id: m.id, filePath })
        else toDisable.push({ id: m.id, filePath })
      }

      // сначала выключаем лишние
      if (toDisable.length) {
        const filesToAssume = toDisable.map(f => f.filePath)
        await invoke("skip_worktree", {
          args: { base_dir: modsDir, files: filesToAssume },
        }).catch(() => undefined)

        await Promise.allSettled(
          toDisable.map(({ filePath }) =>
            invoke("toggle_mod_file", { path: filePath, enable: false })
          )
        )
      }

      // затем включаем нужные
      if (toEnable.length) {
        await Promise.allSettled(
          toEnable.map(({ filePath }) =>
            invoke("toggle_mod_file", { path: filePath, enable: true })
          )
        )
      }

      const changed = [
        ...toDisable.map(x => ({ id: x.id, enabled: false })),
        ...toEnable.map(x => ({ id: x.id, enabled: true })),
      ]

      // синхронизируем стор
      for (const c of changed) dispatch(setModEnabled(c))

      return { changed }
    } catch (e) {
      return rejectWithValue(String(e))
    }
  }
)

const modsSlice = createSlice({
  name: "modsState",
  initialState,
  reducers: {
    setMissingMods: (state, action: PayloadAction<{ missingMods: Mod[] }>) => {
      state.missingMods = action.payload.missingMods
    },
    removeFromMissingMods: (state, action: PayloadAction<Mod>) => {
      const modToRemove = action.payload
      state.missingMods = state.missingMods.filter(mod => mod.id !== modToRemove.id)
    },
    savePresetState: (state, action: PayloadAction<{ presetId: string; modId: string; enabled: boolean }>) => {
      const { presetId, modId, enabled } = action.payload
      if (!state.presetStates[presetId]) state.presetStates[presetId] = {}
      state.presetStates[presetId][modId] = enabled
    },
    resetPresetState: (state, action: PayloadAction<string>) => {
      delete state.presetStates[action.payload]
    },
    setModsData: (state, action: PayloadAction<{ mods: Mod[]; presets: Preset[] }>) => {
      state.mods = action.payload.mods
      state.presets = action.payload.presets
    },
    toggleMod: (state, action: PayloadAction<string>) => {
      const mod = state.mods.find(m => m.id === action.payload)
      if (mod) mod.enabled = !mod.enabled
    },
    setModEnabled: (state, action: PayloadAction<{ id: string; enabled: boolean }>) => {
      const mod = state.mods.find(m => m.id === action.payload.id)
      if (mod) mod.enabled = action.payload.enabled
    },
    setActivePreset: (state, action: PayloadAction<string | null>) => {
      state.activePresetId = action.payload
    },
    setIsApplyingPreset: (state, action: PayloadAction<boolean>) => {
      state.isApplyingPreset = action.payload
    },
  },
  extraReducers: builder => {
    builder
      .addCase(applyPresetOnce.pending, state => {
        state.isApplyingPreset = true
      })
      .addCase(applyPresetOnce.fulfilled, state => {
        state.isApplyingPreset = false
      })
      .addCase(applyPresetOnce.rejected, state => {
        state.isApplyingPreset = false
      })
  },
})

export const {
  setModsData,
  setModEnabled,
  setActivePreset,
  toggleMod,
  setMissingMods,
  removeFromMissingMods,
  savePresetState,
  resetPresetState,
  setIsApplyingPreset,
} = modsSlice.actions

export default modsSlice.reducer
