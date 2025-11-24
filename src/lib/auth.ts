import axios from "axios";
import { store } from "@/store/configureStore";
import { setAuthToken } from "@/store/slice/authSlice";


export async function silentRelogin(activeEndpoint: string) {
  const state = store.getState();
  const login = state.authSlice.userLogin;
  const password = state.authSlice.userPassword;

  if (!activeEndpoint || !login || !password) {
    throw new Error("Silent relogin: missing credentials or endpoint");
  }

  const resp = await axios.post(`${activeEndpoint}/auth/login`, {
    login,
    password,
  }, {
    timeout: 15000,
  });

  const newToken = resp.data?.token;
  if (!newToken) {
    throw new Error("Silent relogin: no token in response");
  }

  store.dispatch(setAuthToken(newToken));

  return newToken;
}

/**
 * Обёртка: вызывает fn(authToken), при 401 делает один silent relogin и повторяет.
 */
export async function withAuthRetry<T>(
  activeEndpoint: string,
  fn: (authToken: string | null) => Promise<T>
): Promise<T> {
  const state = store.getState();
  let token = state.authSlice.authToken;

  try {
    return await fn(token);
  } catch (e: any) {
    const msg = String(e?.message || e);
    const is401 = msg.includes("401") || msg.includes("Unauthorized");
    if (!is401) throw e;

    // один relogin
    const newToken = await silentRelogin(activeEndpoint);
    return await fn(newToken);
  }
}