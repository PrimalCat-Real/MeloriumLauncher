import { createSlice, PayloadAction } from "@reduxjs/toolkit"

export interface UserAuth {
  authToken: string | null
  username: string
  authStatus: boolean
  userLogin: string
  userPassword: string
}


const initialState: UserAuth = {
  authToken: null,
  username: "",
  authStatus: false,
  userLogin: "",
  userPassword: "",
}


const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUserData: (state, action: PayloadAction<Partial<UserAuth>>) => {
      return { ...state, ...action.payload }
    },
    setCredentials: (state, action: PayloadAction<{ userLogin: string; userPassword: string }>) => {
      state.userLogin = action.payload.userLogin
      state.userPassword = action.payload.userPassword
    },
    
    setAuthToken: (state, action: PayloadAction<string>) => {
      state.authToken = action.payload
    },
  
    clearAuthData: () => initialState,
  }
})

export const { 
  setUserData, 
  setCredentials, 
  setAuthToken, 
  clearAuthData 
} = authSlice.actions

export default authSlice.reducer