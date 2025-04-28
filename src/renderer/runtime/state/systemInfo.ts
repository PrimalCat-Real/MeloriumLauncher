import { atom } from 'recoil';

const MIN_RAM_MB = 1024;
const STEP_MB = 256;
const FALLBACK_MAX_RAM_MB = 8192;

const FALLBACK_DEFAULT_RAM_MB = Math.max(MIN_RAM_MB, Math.round(FALLBACK_MAX_RAM_MB / 2 / STEP_MB) * STEP_MB);


export const selectedRamState = atom<number>({
  key: 'selectedRamState',
  default: FALLBACK_DEFAULT_RAM_MB, 
});

export const maxRamState = atom<number | null>({
  key: 'maxRamState',
  default: null,
});
