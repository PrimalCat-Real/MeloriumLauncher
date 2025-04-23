import LoginScene from './components/LoginScene';
import ServerPanel from './components/ServerPanelScene';
import ServersList from './components/ServersListScene';
import Window from './components/Window';

// export для типизации
import { contextBridge, ipcRenderer } from 'electron';

// Добавим новые методы для работы с модами
const modsAPI = {
  getMods: () => ipcRenderer.invoke('get-mods'),
  toggleMod: (modName: string, enable: boolean) =>
    ipcRenderer.invoke('toggle-mod', modName, enable),
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
  mods: modsAPI, 
};

contextBridge.exposeInMainWorld('launcherAPI', API);
