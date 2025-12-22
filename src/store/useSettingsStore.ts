import { SERVER_ENDPOINTS } from '@/lib/config'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface SystemInfo {
    userIp: string | null | undefined,
    ram: {sizeMb: number} | undefined | null,
    cpu: {
        [key: string] : string | number | boolean
    } | undefined | null,
    gpu: {
        [key: string] : string | number | boolean
    } | undefined | null,
    os: {
        [key: string]: string
    } | undefined | null,
}

type Endoint = typeof SERVER_ENDPOINTS.main | typeof SERVER_ENDPOINTS.main


export interface SettingsState extends SystemInfo{
    maxJavaMemory: number | null | undefined,
    activeEndPoint: Endoint,
    selectedJavaMemory: number | null | undefined,
    setActiveEndpoint:  (endpoint: Endoint) => void,
    setProxyEndpoint: () => void,
    setMainEnpoint: () => void,
    setSelectedMemory: (javaMemory: number) => void
}


export const useSettingsStore = create<SettingsState>()(
    persist((set) => ({
        cpu: undefined,
        gpu: undefined,
        
        os: undefined,
        ram: undefined,

        userIp: undefined,

        maxJavaMemory: undefined,
        selectedJavaMemory: 5096,
        activeEndPoint: SERVER_ENDPOINTS.main,
        setActiveEndpoint: (endpoint) => {
            set({
                activeEndPoint: endpoint
            })
        },
        setProxyEndpoint: () => {
            set({
                activeEndPoint: SERVER_ENDPOINTS.proxy
            })
        },
        setMainEnpoint: () => {
            set({
                activeEndPoint: SERVER_ENDPOINTS.main
            })
        },
        setSelectedMemory: (javaMemory) => {
            set({
                selectedJavaMemory: javaMemory
            })
        }
    }),
    {
        name: "settings-storage"
    }
    )
)