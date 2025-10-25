import { createSlice, PayloadAction } from '@reduxjs/toolkit'

type Status = 'downloaded' | 'downloading' | 'interapted' | 'needUpdate' | "needFisrtInstall"
type DownloadState = {
    status: Status,
    gameDir: string,
    localVersion: string | null
    serverVersion: string | null
    ignoredPaths: string[] 
}
const initialState: DownloadState = {
    status: "needFisrtInstall",
    gameDir: "",
    localVersion: null,
    serverVersion: null,
    ignoredPaths: []
}
const downloadSlice = createSlice({
    name: 'downloadStatus',
    initialState,
    reducers: {
        setGameDir: (state, action: PayloadAction<string>) => {
            state.gameDir = action.payload
        },
        changeDownloadStatus: (state, action: PayloadAction<Status>) => {
            state.status = action.payload
        },
        setLocalVersion: (state, action: PayloadAction<string | null>) => {
            state.localVersion = action.payload
        },
        setServerVersion: (state, action: PayloadAction<string | null>) => {
            state.serverVersion = action.payload
        },
        setVersions: (state, action: PayloadAction<{ local: string | null, server: string | null }>) => {
            state.localVersion = action.payload.local
            state.serverVersion = action.payload.server
        },
        setIgnoredPaths: (state, action: PayloadAction<string[]>) => {
            state.ignoredPaths = action.payload
        }
    }
})

export const { 
    changeDownloadStatus, 
    setGameDir, 
    setLocalVersion, 
    setServerVersion,
    setVersions,
    setIgnoredPaths 
} = downloadSlice.actions
export default downloadSlice.reducer