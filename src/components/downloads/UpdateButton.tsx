'use client'
import { STAGES } from '@/lib/utils'
import { RootState } from '@/store/configureStore'
import { listen } from '@tauri-apps/api/event'
import React, { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Button } from '../ui/button'
import { Progress } from '../ui/progress'
import { resolveResource } from '@tauri-apps/api/path'
import { invoke } from '@tauri-apps/api/core'
import { changeDownloadStatus } from '@/store/slice/downloadSlice'

const UpdateButton = () => {
const [progress, setProgress] = useState(0)
  const [output, setOutput] = useState<string>('')
  const [updating, setUpdating] = useState(false)
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
      if (!found && stage !== "Проверка целостности") {
        setStage("Проверка целостности")
        lastStage.current = "Проверка целостности"
      }
      // eslint-disable-next-line
    }).then(x => { unlisten = x })

    return () => { if (unlisten) unlisten() }
    
  }, [])

  const handleUpdate = async () => {
    setUpdating(true)
    outputRef.current = []
    setOutput('')
    setProgress(0)
    setStage("")
    lastStage.current = ""
    try {
      const gitPath = await resolveResource("portable-git/bin/git.exe")
      await invoke('pull_repo', {
        args: {
          git_path: gitPath,
          repo_path: gameDir,
        }
      })
      setUpdating(false)
      dispatch(changeDownloadStatus("downloaded"))
    } catch (e) {
      outputRef.current.push(`Error: ${e?.toString()}`)
      setOutput(outputRef.current.join('\n'))
      setUpdating(false)
      setStage("Error")
    }
  }

  return (
    <div className='flex flex-col w-[425px] gap-4 items-center'>
        {updating && 
            <div className='flex flex-col gap-1 w-full'>
                <Progress className='h-4 w-full' value={progress} max={100} />
                <div className='w-full flex justify-between items-center'>
                <p>{stage || "Запуск"}</p>
                <p>{progress}/100</p>
                </div>
            </div>
        }
        <Button size={"main"} onClick={handleUpdate} disabled={updating || !gameDir}>
        {updating ? "Играть" :"Обновить"}
        </Button>
    </div>
  )
}

export default UpdateButton