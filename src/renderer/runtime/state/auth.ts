import { atom } from 'recoil';

export const lastLoginState = atom<string>({
  key: 'lastLogin',
  default: "",
});

export const lastPasswordState = atom<string>({
  key: 'lastPassword',
  default: "",
});