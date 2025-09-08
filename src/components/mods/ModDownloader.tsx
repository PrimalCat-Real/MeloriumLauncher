'use client'
import axios from 'axios'
import React, { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '../ui/button'
import { Mod, removeFromMissingMods, setModEnabled } from '@/store/slice/modsSlice'
import { Download, LoaderCircle } from 'lucide-react'
import { Progress } from '../ui/progress'
import { useDispatch, useSelector } from 'react-redux'
import { invoke } from '@tauri-apps/api/core'
import { RootState } from '@/store/configureStore'
import { getParents } from '@/lib/utils'
import { SERVER_ENDPOINTS } from '@/lib/config'

interface ModDownloaderProps {
  mod: Mod
  modsPath: string
}


const ModDownloader = ({ mod, modsPath }: ModDownloaderProps) => {
  const activeEndPoint = useSelector(
    (s: RootState) => s.settingsState.activeEndPoint
  )
  const downloadUrl = useMemo(() => {
    // fallback
    let base = String(activeEndPoint ?? SERVER_ENDPOINTS.main)

    // ensure scheme present
    if (!/^https?:\/\//i.test(base)) base = `http://${base}`

    // remove trailing slashes
    base = base.replace(/\/+$/, '')

    return `${base}/download/mod`
  }, [activeEndPoint])
  const dispatch = useDispatch()
  const [downloading, setDownloading] = useState(false)

  const mods = useSelector((state: RootState) => state.modsSlice.mods)
  const userLogin = useSelector((state: RootState) => state.authSlice.userLogin)
  const userPassword = useSelector((state: RootState) => state.authSlice.userPassword)

  const collectWithDependencies = useCallback(
    (target: Mod, allMods: Mod[], acc: Mod[] = []): Mod[] => {
      if (acc.find((m) => m.id === target.id)) return acc
      acc.push(target)

      const parents = getParents(target.id, allMods)
      parents.forEach((parentId) => {
        const parent = allMods.find((m) => m.id === parentId)
        if (parent) {
          collectWithDependencies(parent, allMods, acc)
        }
      })

      return acc
    },
    []
  )

  const downloadMod = useCallback(
    async (targetMod: Mod) => {
      setDownloading(true)

      try {
        const modsToDownload = collectWithDependencies(targetMod, mods)

        for (const m of modsToDownload) {
          try {
            await invoke('download_mod_file', {
              url: downloadUrl,
              path: modsPath,
              modName: m.file,
              username: userLogin,
              password: userPassword,
            })

            // await invoke('skip_worktree', {
            //   args: {
            //     base_dir: modsPath,
            //     files: [m.file],
            //   },
            // })

            console.log(`Мод ${m.file} был успешно загружен`)
            dispatch(removeFromMissingMods(m))
            dispatch(setModEnabled({ id: m.id, enabled: true }))
          } catch (e) {
            console.error(`Ошибка загрузки ${m.file}:`, e)
            toast.error(`Не удалось загрузить мод ${m.name}`, {
              description: String(e),
            })
          }
        }
      } finally {
        setDownloading(false)
      }
    },
    [mods, modsPath]
  )

  return (
    <Button
      size={'none'}
      className='inline-flex px-2 py-4'
      variant={'outline'}
      disabled={downloading}
      onClick={() => downloadMod(mod)}
    >
      {downloading ? (
        <LoaderCircle className='animate-spin text-secondary' />
      ) : (
        <Download />
      )}
    </Button>
  )
}

export default React.memo(ModDownloader)  