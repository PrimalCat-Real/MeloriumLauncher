import { createSlice, PayloadAction } from '@reduxjs/toolkit'

type Status = 'downloaded' | 'downloading' | 'interapted' | 'needUpdate' | "needFisrtInstall"
type DownloadState = {
    status: Status,
    gameDir: string
}
const initialState: DownloadState = {
    status: "needFisrtInstall",
    gameDir: ""
}
const downloadSlice = createSlice({
    name: 'downloadStatus',
    initialState,
    reducers: {
        setGameDir: (state, action: PayloadAction<string>) => {
            state.gameDir = action.payload
        },  
        changeDownloadStatus: (state, action: PayloadAction<Status>) => {state.status = action.payload},
    }
})

export const { changeDownloadStatus, setGameDir } = downloadSlice.actions
export default downloadSlice.reducer