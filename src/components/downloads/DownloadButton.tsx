'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Progress } from '../ui/progress'
import { Button } from '../ui/button'
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { resolveResource } from "@tauri-apps/api/path"
import { useDispatch, useSelector } from 'react-redux'
import { changeDownloadStatus, setGameDir } from '@/store/slice/downloadSlice'
import { Dialog, DialogTrigger, DialogContent, DialogTitle } from '../ui/dialog'
import { Input } from '../ui/input'
import { RootState } from '@/store/configureStore'
import { open } from '@tauri-apps/plugin-dialog';
import { FolderSearch } from 'lucide-react'
import { toast } from 'sonner'
import { cn, handleIgnoreClientSettings, STAGES } from '@/lib/utils'
import { FILES_TO_SKIP_WORKTREE, repo_path } from '@/lib/config'
import path from 'path'




const DownloadButton = () => {
  const [progress, setProgress] = useState(0)
  const [output, setOutput] = useState<string>('')
  const [downloading, setDownloading] = useState(false)
  const [stage, setStage] = useState<string>("")
  const outputRef = useRef<string[]>([])
  const lastStage = useRef<string>("")
  const dispatch = useDispatch()
  const gameDir = useSelector((state: RootState) => state.downloadSlice.gameDir)

  useEffect(() => {
    let unlisten: (() => void) | undefined
    listen<string>('git-progress', (event) => {
      const text = event.payload || ''
      outputRef.current.push(text)
      setOutput(outputRef.current.join('\n'))

      let found = false
      for (const s of STAGES) {
        const m = text.match(s.rx)
        if (m) {
          if (lastStage.current !== s.key) {
            setProgress(0)        
            setStage(s.key)
            lastStage.current = s.key
          }
          setProgress(Number(m[1]))
          found = true
          break
        }
      }
      if (!found) {
        for (const s of STAGES) {
          if (text.includes(s.key)) {
            if (lastStage.current !== s.key) {
              setProgress(0)
              setStage(s.key)
              lastStage.current = s.key
            }
            found = true
            break
          }
        }
      }
      if (!found && stage !== "В процессе") {
        setStage("В процессе")
        lastStage.current = "В процессе"
      }
    }).then(x => { unlisten = x })

    return () => { if (unlisten) unlisten() }
    // eslint-disable-next-line
  }, [])

  const handleDownload = async () => {
    setDownloading(true)
    outputRef.current = []
    setOutput('')
    setProgress(0)
    setStage("")
    lastStage.current = ""
    try {
      const gitPath = await resolveResource("portable-git/bin/git.exe")
      await invoke('clone_repo', {
        args: {
          git_path: gitPath,
          repository_url: repo_path,
          destination_path: gameDir
        }
      })
      await handleIgnoreClientSettings(gameDir, toast)
      setDownloading(false)
      dispatch(changeDownloadStatus("downloaded"))
    } catch (e) {
      outputRef.current.push(`Error: ${e?.toString()}`)
      setOutput(outputRef.current.join('\n'))
      setDownloading(false)
      setStage("Error")
    }
    
  }

  

  const handleChooseDir = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Выберите папку для установки игры",
    });
    if (selected && typeof selected === "string") {
      let pathToUse = selected;
      
      const isEmpty = await invoke<boolean>('is_dir_empty', { path: selected });
      if (!isEmpty) {
        pathToUse = selected.endsWith('melorium') ? selected : `${selected}/melorium`;
        const meloriumExists = await invoke<boolean>('is_dir_empty', { path: pathToUse }).catch(() => null);
        if (meloriumExists === false) {
          toast.error("Ошибка", {
            description: "Папка melorium внутри выбранной директории уже существует и не пуста.",
          });
          return;
        }
      }
      if(pathToUse) dispatch(setGameDir(pathToUse))
      
    }
    
  }
  

  return (
    <div className='flex h-40 flex-col'>
      <Dialog>
        <DialogTrigger asChild>
          <Button size={"main"}>Скачать</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px] flex flex-col gap-4 rounded-2xl">
          <DialogTitle className='text-md'>{downloading ? "Загрузка" :"Выберите путь установки"}</DialogTitle>
          {
            downloading ? 
            <>
              <Progress className='h-4 w-full' value={progress} max={100} /> 
              <div className='w-full flex justify-between items-center'>
                <p>{stage || "Запуск"}</p>
                <p>{progress}/100</p>
              </div>
            </>:
            <>
              <Button variant={'outline'} className='w-full text-start justify-between px-8 flex ' onClick={handleChooseDir}>
                <span className={cn('text-ellipsis whitespace-nowrap text-righ min-w-0 [direction:rtl] text-left overflow-hidden', !gameDir.replace("/", "\\") && "[direction:ltr]")}>{gameDir ? gameDir.replace("/", "\\") : "Выбрать путь..." } </span>
                <FolderSearch /></Button>
              <Button className='w-full' size={"main"} onClick={handleDownload} disabled={downloading || !gameDir}>
                Скачать
                
              </Button>
            </>
          }
          
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default DownloadButton
