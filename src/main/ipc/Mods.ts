import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';

const modsPath = "C:\\Users\\roman\\.aurora-launcher\\clients\\Melorium\\mods";
const blacklist = ["examplemod.jar"];

export function registerModHandlers() {
  ipcMain.handle('get-mods', async () => {
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
    const modPath = path.join(modsPath, modName);
    const disabledPath = modPath + ".disabled";

    if (enable) {
      if (fs.existsSync(disabledPath)) fs.renameSync(disabledPath, modPath);
    } else {
      if (fs.existsSync(modPath)) fs.renameSync(modPath, disabledPath);
    }
  });
}
