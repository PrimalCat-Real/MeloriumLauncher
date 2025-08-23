import { SERVER_ENDPOINTS } from "@/lib/config";
import { createSlice, PayloadAction } from "@reduxjs/toolkit"

export interface UserSettings {
  javaMemory: number,
  activeEndPoint: string
}


const initialState: UserSettings = {
  javaMemory: 5096, // Default to 4GB
  activeEndPoint: SERVER_ENDPOINTS.main
}

const modsSlice = createSlice({
    name: 'settingsState',
    initialState,
    reducers: {
        setJavaMemory: (state, action: PayloadAction<{ javaMemory: number; }>) => {
            state.javaMemory = action.payload.javaMemory;
        },
        setActiveEndPoint: (state, action: PayloadAction<{ activeEndPoint: string; }>) => {
            state.activeEndPoint = action.payload.activeEndPoint;
        }
    }
})

export const { setJavaMemory, setActiveEndPoint } = modsSlice.actions
export default modsSlice.reducer