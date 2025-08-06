import { createSlice, PayloadAction } from "@reduxjs/toolkit"

export interface UserAuth {
  userLogin: string;
  userPassword: string;
  donateTokens: number;
  userUuid: string;
  authStatus: boolean
}


const initialState: UserAuth = {
  userLogin: "",
  userPassword: "",
  donateTokens: 0,
  userUuid: "",
  authStatus: false
}

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        setUserData: (state, action: PayloadAction<UserAuth>) => {
            state.userLogin = action.payload.userLogin;
            state.userPassword = action.payload.userPassword;
            state.donateTokens = action.payload.donateTokens;
            state.userUuid = action.payload.userUuid;
            state.authStatus = action.payload.authStatus;
        },
        setCredentials: (state, action: PayloadAction<{ userLogin: string; userPassword: string }>) => {
          state.userLogin = action.payload.userLogin;
          state.userPassword = action.payload.userPassword;
        },
        clearAuthData: () => initialState,
    }
})

export const { setUserData, setCredentials, clearAuthData } = authSlice.actions;
export default authSlice.reducer;