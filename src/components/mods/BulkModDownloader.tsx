import { RootState } from '@/store/configureStore'
import { Mod, Preset, removeFromMissingMods, setModEnabled } from '@/store/slice/modsSlice'
import { invoke } from '@tauri-apps/api/core'
import { Props } from 'next/script'
import React, { useCallback, useMemo, useState } from 'react'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import { toast } from 'sonner'
import { Button } from '../ui/button'
import { CloudDownload, LoaderCircle } from 'lucide-react'
import { Progress } from '../ui/progress'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { SERVER_ENDPOINTS } from '@/lib/config'

const BulkModDownloader = ({ modsPath }: { modsPath: string }) => {
  const dispatch = useDispatch()
  const mods = useSelector((s: RootState) => s.modsSlice.mods, shallowEqual)
  const missingMods = useSelector((s: RootState) => s.modsSlice.missingMods, shallowEqual)
  const { presets, activePresetId } = useSelector((s: RootState) => s.modsSlice, shallowEqual)
  const userLogin = useSelector((s: RootState) => s.authSlice.userLogin)
  const userPassword = useSelector((s: RootState) => s.authSlice.userPassword)

  const [loading, setLoading] = useState(false)

const activeEndPoint = useSelector((s: RootState) => s.settingsState.activeEndPoint)
const downloadUrl = useMemo(() => {
    // fallback
    let base = String(activeEndPoint ?? SERVER_ENDPOINTS.main)

    // ensure scheme present
    if (!/^https?:\/\//i.test(base)) base = `http://${base}`

    // remove trailing slashes
    base = base.replace(/\/+$/, '')

    return `${base}/download/mod`
}, [activeEndPoint])

  // Compute missing mods relevant for the active preset.
  const targetMissingMods = useMemo<Mod[]>(() => {
    const preset = presets.find((p) => p.id === activePresetId)
    if (!preset) return missingMods
    if (preset.mods === 'all') return missingMods
    const allowed = new Set<string>(preset.mods as string[])
    return missingMods.filter((m) => allowed.has(m.id))
  }, [presets, activePresetId, missingMods])

  if (!loading && targetMissingMods.length === 0) return null

  // Build parent-first ordered list for a start mod.
  const collectMissingDepsOrdered = useCallback(
    (start: Mod, allMods: Mod[], missingSet: Set<string>, result: Mod[], visited: Set<string>) => {
      // depth-first recursive visit. parents processed before child.
      const visit = (m: Mod) => {
        if (visited.has(m.id)) return
        visited.add(m.id)
        const deps = m.dependsOn ?? []
        for (const depId of deps) {
          if (!missingSet.has(depId)) continue
          const parent = allMods.find((x) => x.id === depId)
          if (parent) visit(parent)
        }
        result.push(m) // push after parents => parent-first order
      }
      visit(start)
    },
    []
  )

  const downloadAll = useCallback(async () => {
    if (targetMissingMods.length === 0) {
      toast('Нет отсутствующих модов для текущего пресета')
      return
    }

    setLoading(true)

    try {
      const missingIds = new Set<string>(missingMods.map((m) => m.id))
      const ordered: Mod[] = []
      const globalVisited = new Set<string>()

      // collect ordered list for each target missing mod
      for (const mm of targetMissingMods) {
        collectMissingDepsOrdered(mm, mods, missingIds, ordered, globalVisited)
      }

      // dedupe preserving order
      const seen = new Set<string>()
      const toDownload: Mod[] = []
      for (const m of ordered) {
        if (!seen.has(m.id)) {
          seen.add(m.id)
          toDownload.push(m)
        }
      }

      // sequential download; on error skip and continue
      for (const mod of toDownload) {
        try {
          await invoke('download_mod_file', {
            url: downloadUrl,
            path: modsPath,
            modName: mod.file,
            username: userLogin,
            password: userPassword,
          })

          // await invoke('skip_worktree', {
          //   args: {
          //     base_dir: modsPath,
          //     files: [mod.file],
          //   },
          // })

          dispatch(removeFromMissingMods(mod))
          dispatch(setModEnabled({ id: mod.id, enabled: true }))
        } catch (e) {
          // log and continue to next mod
          console.error(`Failed to download ${mod.file}`, e)
          toast.error(`Не удалось загрузить мод ${mod.name}`, { description: String(e) })
          // intentionally do not rethrow
        }
      }
    } finally {
      setLoading(false)
    }
  }, [collectMissingDepsOrdered, modsPath, mods, missingMods, targetMissingMods, userLogin, userPassword, dispatch])

  const disabled = loading || targetMissingMods.length === 0

  return (
    <div className="flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="outline"
            onClick={downloadAll}
            disabled={disabled}
            aria-label="Download missing mods for active preset"
            className="inline-flex items-center p-2 rounded-full"
          >
            {loading ? <LoaderCircle className="animate-spin h-4 w-4" /> : <CloudDownload className="h-4 w-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Скачать все</p>
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

export default React.memo(BulkModDownloader)