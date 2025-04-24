import { ipcMain } from 'electron';
import fs from 'fs';
import { StorageHelper } from 'main/helpers/StorageHelper';
import path, { join } from 'path';


const blacklist = ["examplemod.jar"];

export function registerModHandlers() {
    ipcMain.handle('get-mods', async () => {
    const modsPath = join(StorageHelper.clientsDir, 'Melorium', 'mods');
    if (!fs.existsSync(modsPath)) return [];

    return fs.readdirSync(modsPath)
      .filter(f => (f.endsWith('.jar') || f.endsWith('.jar.disabled')))
      .map(f => ({
        name: f.replace(/\.disabled$/, ''),
        enabled: !f.endsWith('.disabled'),
      }))
      .filter(mod => !blacklist.includes(mod.name));
  });

  ipcMain.handle('toggle-mod', async (_event, modName: string, enable: boolean) => {
    const modsPath = join(StorageHelper.clientsDir, 'Melorium', 'mods');
    const modPathD = path.join(modsPath, modName);
    const disabledPath = modPathD + ".disabled";

    if (enable) {
      if (fs.existsSync(disabledPath)) fs.renameSync(disabledPath, modPathD);
    } else {
      if (fs.existsSync(modPathD)) fs.renameSync(modPathD, disabledPath);
    }
  });
}
