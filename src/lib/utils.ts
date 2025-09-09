import { Mod } from "@/store/slice/modsSlice";
import { invoke } from "@tauri-apps/api/core";
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { FILES_TO_SKIP_WORKTREE } from "./config";
import { toast, type Toaster } from "sonner";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


export const STAGES = [
  { key: "Подсчёт объектов", rx: /Counting objects:\s+(\d+)%/ },
  { key: "Сжатие объектов", rx: /Compressing objects:\s+(\d+)%/ },
  { key: "Получение объектов", rx: /Receiving objects:\s+(\d+)%/ },
  { key: "Загрузка обновлений", rx: /Resolving deltas:\s+(\d+)%/ },
  { key: "Применение обновлений", rx: /Updating files:\s+(\d+)%/ }
]

export type AuthResult = {
  is_authenticated: boolean;
  uuid?: string;
  accesstoken?: string;
  error?: string;
};

export async function useAuth(login: string, password: string): Promise<AuthResult> {
  return await invoke<AuthResult>('authenticate', { login, password });
}


export function getDependants(modId: string, allMods: Mod[]): string[] {
  const visited = new Set<string>()
  const queue = [modId]

  while (queue.length) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)

    for (const m of allMods) {
      if ((m.dependsOn ?? []).includes(current) && !visited.has(m.id)) {
        queue.push(m.id)
      }
    }
  }

  visited.delete(modId)
  return [...visited]
}

export function getParents(modId: string, allMods: Mod[]): string[] {
  const mod = allMods.find(m => m.id === modId)
  if (!mod) return []
  const parents = mod.dependsOn ?? []
  const missingParents = parents.filter(id =>
    !allMods.find(m => m.id === id)?.enabled
  )
  return missingParents
}


export const handleIgnoreClientSettings = async (gameDir: string,  toaster: typeof toast) =>{
    try {
        await invoke('skip_worktree', {
          args: {
            base_dir: gameDir,
            files: FILES_TO_SKIP_WORKTREE,
          }
        });
        console.log("Файлы добавлены в исключение:", FILES_TO_SKIP_WORKTREE);
    } catch (e) {
      toaster.error("Не удалось добавить файлы в skip-worktree:", {
        description: String(e),
      });
    }
}


import {
  getCpuInfo,
  getRamInfo,
  getGpuInfo,
  getOsInfo,
} from "tauri-plugin-hwinfo";

export async function getPlayerSystemInfo() {
  const cpu = await getCpuInfo();
  const ram = await getRamInfo();
  const gpu = await getGpuInfo();
  const os = await getOsInfo();

  return {
    cpu,
    ram,
    gpu,
    os
  };
}

import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import axios from "axios";

async function checkAndUpdate(toaster: typeof toast) {
  try {
    const update = await check();
    if (update) {
      toaster.info('Доступно обновление', {
        description: `Загрузка и установка версии ${update.version}`
      });
      // console.log(`Знайдено оновлення ${update.version}`);

      await update.downloadAndInstall();

      await relaunch();
    }
  } catch (error) {
    toaster.error('Error while check updates:', {
      description: String(error),
    });
  }
}



// export const whitelistIp = async (endpoint: string, payload: { address: string; login: string; accessToken: string }) => {
//   const res = await tfetch(`${endpoint}/ip-whitelist`, {
//     method: "POST",
//     timeout: 20, // seconds
//     responseType: ResponseType.JSON,
//     headers: { "Content-Type": "application/json" },
//     body: { type: "Json", payload }
//   });
//   if (res.status !== 200) {
//     const msg = typeof res.data === "string" ? res.data : (res.data?.error ?? "Whitelist failed");
//     throw new Error(String(msg));
//   }
//   return res.data;
// };


const withAbortSignal = (timeoutMs: number): AbortSignal => {
  if (typeof (AbortSignal as any).timeout === "function") {
    return (AbortSignal as any).timeout(timeoutMs);
  }
  const c = new AbortController();
  setTimeout(() => c.abort(new DOMException("Timeout", "AbortError")), timeoutMs);
  return c.signal;
};

export const getPublicIp = async (timeoutSec = 10): Promise<string> => {
  const signal = withAbortSignal(timeoutSec * 1000);
  const res = await axios.get<{ ip: string }>("https://api.ipify.org", {
    params: { format: "json" },
    timeout: timeoutSec * 1000,
    signal,
  });
  if (res.status !== 200 || !res.data?.ip) throw new Error("Failed to get public IP");
  return res.data.ip;
};

export const whitelistIp = async (
  endpoint: string,
  payload: { login: string; accessToken: string; address?: string },
  timeoutSec = 15
) => {
  const signal = withAbortSignal(timeoutSec * 1000);
  const res = await axios.post(`${endpoint}/ipWhitelist`, payload, {
    timeout: timeoutSec * 1000,
    signal,
    headers: { "Content-Type": "application/json" },
    // withCredentials: true, // uncomment if backend uses cookies/sessions
  });
  if (res.status < 200 || res.status >= 300) {
    const msg = typeof res.data === "string" ? res.data : (res.data?.error ?? "Whitelist failed");
    throw new Error(String(msg));
  }
  return res.data;
};