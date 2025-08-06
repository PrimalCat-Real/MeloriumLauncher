import { createSlice, PayloadAction } from "@reduxjs/toolkit"

export interface UserSettings {
  javaMemory: number
}


const initialState: UserSettings = {
  javaMemory: 1024, // Default to 1GB
}

const modsSlice = createSlice({
    name: 'settingsState',
    initialState,
    reducers: {
        setJavaMemory: (state, action: PayloadAction<{ javaMemory: number; }>) => {
            state.javaMemory = action.payload.javaMemory;
        },
    }
})

export const { setJavaMemory } = modsSlice.actions
export default modsSlice.reducer