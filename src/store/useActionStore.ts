import { create } from 'zustand'
import { persist } from 'zustand/middleware'



type ActionStatus = 'not-installed' | 'installing' | 'need-update' | 'updating' | 'verify' | 'installed' | 'idle'


export interface ActionState {
    actioneStatus: ActionStatus,
    gameDirection: string | null | undefined,
    localGameVersion: string | null | undefined,
    serverGameVersion: string | null | undefined,
    ignoredPaths: string[],
    setGameDirection: (gameDirection: string) => void,
    setLocalGameVersion: (localGameVersion: string) => void,
    setServerGameVersion: (serverGameVersion: string) => void,
    setIgnoredPaths: (paths: string[]) => void
    setActionStatus: (actioneStatus: ActionStatus) => void
    setVersions: (local: string | null, server: string | null) => void
}


export const useActionStore = create<ActionState>()(
    persist((set) => ({
        actioneStatus: "not-installed",
        gameDirection: null,
        localGameVersion: null,
        serverGameVersion: null,
        ignoredPaths: [],
        setVersions: (local, server) => set({ 
            localGameVersion: local, 
            serverGameVersion: server 
        }),
        setActionStatus(actioneStatus) {
            set({
                actioneStatus
            })
        },
        setGameDirection(gameDirection) {
            set({
                gameDirection
            })
        },
        setIgnoredPaths(paths) {
            set({
                ignoredPaths: paths
            })
        },
        setLocalGameVersion(localGameVersion) {
            set({
                localGameVersion
            })
        },
        setServerGameVersion(serverGameVersion) {
            set({
                serverGameVersion
            })
        },
    }),
    {
        name: "action-storage"
    }
    )
)