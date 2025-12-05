import { RootState } from "@/store/configureStore"


export const selectAuthToken = (state: RootState) => state.session.authToken
export const selectIsAuth = (state: RootState) => state.session.authStatus
export const selectAuthCredentials = (state: RootState) => ({
    userLogin: state.session.userLogin,
    userPassword: state.session.userPassword
})