'use client'
import { invoke } from '@tauri-apps/api/core'
import React, { useEffect, useState } from 'react'
import { Slider } from '../ui/slider'
import { cn } from '@/lib/utils'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '@/store/configureStore'
import { setJavaMemory } from '@/store/slice/settingsSlice'
import { Input } from '../ui/input'

const RamSelector = () => {
    const dispatch = useDispatch()
    const javaMemory = useSelector((state: RootState) => state.settingsState.javaMemory)
    const [sliderValue, setSliderValue] = useState(javaMemory)
    
    const [inputValue, setInputValue] = useState(javaMemory.toString())
    const minRam = 4096 // 4 GB minimum RAM for Java
    const [userRAM, setUserRAM] = useState(minRam)
    useEffect(() => {
        const initUserRam = async () => {
            const totalMb: number = await invoke("get_total_memory_mb");
            console.log("RAM:", totalMb, "MB");
            setUserRAM(Math.round(totalMb - totalMb*0.10))

            const clamped = Math.max(minRam, Math.min(javaMemory, totalMb))
            setSliderValue(clamped)
            setInputValue(clamped.toString())
        }
        initUserRam()
   
    }, [])

    const handleRamChange = (value: number[]) => {
        setSliderValue(value[0])
        setInputValue(value[0].toString())
    }

    const handleRamCommit = (value: number[]) => {
        const selected = value[0]
        const clamped = Math.max(minRam, Math.min(selected, userRAM))
        dispatch(setJavaMemory({ javaMemory: clamped }))
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value)
    }

    const applyInputValue = () => {
        const parsed = parseInt(inputValue)
        const clamped = isNaN(parsed) ? minRam : Math.max(minRam, Math.min(parsed, userRAM))
        setSliderValue(clamped)
        dispatch(setJavaMemory({ javaMemory: clamped }))
        setInputValue(clamped.toString())
    }
        
  return (
    <div className='flex w-full flex-col z-20 gap-4'>
        <h2 className='font-semibold'>Количество оперативной памяти</h2>
        <div className='flex w-full gap-4 flex-row-reverse'>
            <Input
                className='max-w-28 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none leading-4 h-8'
                type='number'
                value={inputValue}
                onChange={handleInputChange}
                onBlur={applyInputValue}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') applyInputValue()
                }}
                placeholder={minRam.toString()}
            />
            <div className='flex flex-col w-full gap-1 justify-end'>
            <Slider
                min={minRam}
                max={userRAM}
                step={1}
                value={[sliderValue]}
                onValueChange={handleRamChange}
                onValueCommit={handleRamCommit}
                className={cn("w-full")}
            />
            <div className='w-full justify-between flex items-center text-sm'>
                <span>{minRam} MB</span>
                <span>{userRAM} MB</span>
            </div>
            </div>
            
        </div>
    </div>
    
  )
}

export default RamSelector