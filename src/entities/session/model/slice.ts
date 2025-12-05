import { createSlice, PayloadAction } from "@reduxjs/toolkit"


interface AuthState {
  authToken: string | null
  authStatus: boolean
  userLogin?: string
  userPassword?: string
}

const initialState: AuthState = {
  authToken: null,
  authStatus: false,
  userLogin: '',
  userPassword: '',
}


export const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    setUserData: (state, action: PayloadAction<AuthState>) => {
      state.authToken = action.payload.authToken
      state.authStatus = action.payload.authStatus
      state.userLogin = action.payload.userLogin
      state.userPassword = action.payload.userPassword
    },
    logout: (state) => {
      state.authToken = null
      state.authStatus = false
    },
    setCredentials: (state, action: PayloadAction<{login: string, password: string}>) => {
        state.userLogin = action.payload.login
        state.userPassword = action.payload.password
    }
  },
})

export const { setUserData, logout, setCredentials } = sessionSlice.actions
export const sessionReducer = sessionSlice.reducer