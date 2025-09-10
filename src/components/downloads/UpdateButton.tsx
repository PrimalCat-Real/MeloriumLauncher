// React: не снимаем busy в finally. Ждём git-complete/git-error. Логи — как есть.
'use client'

import React, { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { resolveResource } from '@tauri-apps/api/path'
import { invoke } from '@tauri-apps/api/core'
import { listen, UnlistenFn } from '@tauri-apps/api/event'
import { useSelector } from 'react-redux'
import { RootState } from '@/store/configureStore'

const UpdateButton: React.FC = () => {
  const gameDir = useSelector((state: RootState) => state.downloadSlice.gameDir)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errorText, setErrorText] = useState<string | null>(null)
  const [lastLine, setLastLine] = useState<string>('—')
  const [progressPercent, setProgressPercent] = useState<number | null>(null)

  const handleOpen = useCallback((): void => { setOpen(true) }, [])
  const handleOpenChange = useCallback((next: boolean): void => { setOpen(next) }, [])

  const parsePercent = useCallback((line: string): number | null => {
    const match = line.match(/(\d{1,3})\s*%/)
    if (!match) return null
    const value = Number(match[1])
    if (Number.isNaN(value) || value < 0 || value > 100) return null
    return value
  }, [])

  useEffect(() => {
    let unsubs: UnlistenFn[] = []
    const wire = async (): Promise<void> => {
      unsubs.push(await listen<string>('git-start', () => { setBusy(true) }))
      unsubs.push(await listen<string>('git-progress', (e) => {
        const payload = e.payload
        if (!payload) return
        const parts = payload.split(/\r|\n/)
        const tail = parts.filter((p) => p.trim().length > 0).pop()
        if (tail) {
          setLastLine(tail)
          const p = parsePercent(tail)
          if (p !== null) setProgressPercent(p)
        }
      }))
      unsubs.push(await listen<string>('git-error', (e) => {
        setBusy(false)
        setErrorText(e.payload ?? 'Ошибка обновления')
      }))
      unsubs.push(await listen<string>('git-complete', () => {
        setBusy(false)
      }))
    }
    void wire()
    return () => { for (const u of unsubs) u() }
  }, [parsePercent])

  const handleRunUpdate = useCallback(async (): Promise<void> => {
    setErrorText(null)
    setProgressPercent(null)
    setLastLine('—')
    try {
      if (!gameDir) throw new Error('Не задан путь установки')
      const gitPath = await resolveResource('portable-git/bin/git.exe')
      setBusy(true)
      await invoke('install_lfs', { args: { git_path: gitPath } })
      await invoke('pull_repo', { args: { git_path: gitPath, repo_path: gameDir } })
      // busy будет снят по событию git-complete
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setErrorText(message)
      setBusy(false)
    }
  }, [gameDir])

  const actionDisabled = useMemo(() => busy || !gameDir, [busy, gameDir])

  return (
    <div className="flex flex-col items-center gap-3">
      <Button size="main" onClick={handleOpen}>Обновление</Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[420px] rounded-2xl">
          <div className="flex flex-col gap-3">
            <div className="text-sm text-muted-foreground">Обновление репозитория</div>

            <div className="text-xs">
              <span className="font-medium">Лог: </span>
              <span className="break-all">{lastLine}</span>
            </div>

            <div className="text-xs">
              <span className="font-medium">Прогресс: </span>
              {progressPercent !== null ? <span>{progressPercent}%</span> : <span>нет данных</span>}
            </div>

            {errorText && <div className="text-xs text-red-500">Ошибка: {errorText}</div>}

            <div className="flex gap-2">
              <Button onClick={handleRunUpdate} disabled={actionDisabled}>
                {busy ? 'Работаю…' : 'Запустить обновление'}
              </Button>
              <Button variant="outline" disabled={busy} onClick={useCallback(() => setOpen(false), [])}>
                Закрыть
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default memo(UpdateButton)
