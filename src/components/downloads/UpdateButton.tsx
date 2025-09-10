'use client'

import React, { memo, useCallback, useEffect, useState } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { resolveResource } from '@tauri-apps/api/path'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useSelector } from 'react-redux'
import { RootState } from '@/store/configureStore'

const UpdateButton: React.FC = () => {
  const gameDir = useSelector((s: RootState) => s.downloadSlice.gameDir)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [ok, setOk] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let unlisten: (() => void) | undefined
    listen<string>('git-progress', e => {
      if (e.payload) console.log('[git]', e.payload)
    }).then(d => { unlisten = d })
    return () => { if (unlisten) unlisten() }
  }, [])

  const onInstallLfs = useCallback(async () => {
    setBusy(true); setErr(null); setOk(false)
    try {
      const gitPath = await resolveResource('portable-git/bin/git.exe')
      await invoke('install_lfs', { args: { git_path: gitPath } })
      setOk(true)
    } catch (e) {
      setErr(String(e))
    } finally {
      setBusy(false)
    }
  }, [])

  const onPull = useCallback(async () => {
    if (!gameDir) { setErr('Не задан путь установки'); return }
    setBusy(true); setErr(null)
    try {
      const gitPath = await resolveResource('portable-git/bin/git.exe')
      await invoke('pull_repo', { args: { git_path: gitPath, repo_path: gameDir } })
      console.log('[git] pull done')
    } catch (e) {
      setErr(String(e))
    } finally {
      setBusy(false)
    }
  }, [gameDir])

  return (
    <div className="flex flex-col gap-3 items-center">
      <Button size="main" onClick={() => setOpen(true)}>Обновление</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[420px] rounded-2xl">
          <h2 className="text-lg font-semibold">Установка Git LFS</h2>
          <p className="text-sm text-muted-foreground">Нужно для модов. Без логов и прогресса. Режим разработки.</p>

          {err && <div className="text-xs text-red-500">Ошибка: {err}</div>}
          {ok && !err && <div className="text-xs text-green-600">Готово: LFS установлен.</div>}

          <div className="flex gap-2">
            <Button onClick={onInstallLfs} disabled={busy}>
              {busy ? 'Работаю…' : 'Установить LFS'}
            </Button>
            <Button variant="secondary" onClick={onPull} disabled={busy || !gameDir}>
              {busy ? 'Работаю…' : 'Pull с прогрессом'}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Закрыть
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default memo(UpdateButton)
