import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type AuthStatus = | "authenticated" | "expired" | "need-authentication"

export interface AuthState {
  authToken: string | null
  username: string
  password: string
  authStatus: AuthStatus
  setAuthCredits: (username: string, password: string, authToken: string) => void
  setAuthStatus: (authStatus: AuthStatus) => void,
  clearAuthCredits: () => void
}


export const useAuthStore = create<AuthState>()(
    persist((set) => ({
        authToken: null,
        username: "",
        password: "",
        authStatus: "need-authentication",
        setAuthCredits(username, password, authToken) {
            set({
                username,
                password,
                authToken
            })
        },
        setAuthStatus(authStatus) {
            set({
                authStatus
            })
        },
        clearAuthCredits: () => set({ authToken: null, username: "", password: "" }),
    }),
    {
        name: "auth-storage"
    }
    )
)