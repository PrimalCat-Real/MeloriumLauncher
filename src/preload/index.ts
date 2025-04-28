import LoginScene from './components/LoginScene';
import ServerPanel from './components/ServerPanelScene';
import ServersList from './components/ServersListScene';
import Window from './components/Window';

import { contextBridge, ipcRenderer } from 'electron';

const modsAPI = {
  getMods: () => ipcRenderer.invoke('get-mods'),
  toggleMod: (modName: string, enable: boolean) =>
    ipcRenderer.invoke('toggle-mod', modName, enable),
};

const systemAPI = {
  getRamMB: () => ipcRenderer.invoke('get-system-ram-mb'),
};

const gameAPI = {
  setRam: (ramMb: number) => ipcRenderer.invoke('set-game-ram', ramMb)
};


export const API = {
  window: {
    hide: Window.hide,
    close: Window.close,
  },
  scenes: {
    login: {
      auth: LoginScene.auth,
    },
    serversList: {
      getServers: ServersList.getServers,
      selectServer: ServersList.selectServer,
    },
    serverPanel: {
      getProfile: ServerPanel.getProfile,
      getServer: ServerPanel.getServer,
      startGame: ServerPanel.startGame,
    },
  },
  game: gameAPI,
  mods: modsAPI, 
  system: systemAPI,
};

contextBridge.exposeInMainWorld('launcherAPI', API);
