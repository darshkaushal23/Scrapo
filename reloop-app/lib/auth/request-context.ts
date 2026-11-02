import { AsyncLocalStorage } from "node:async_hooks";

export type AuthRequestContext = {
  idToken: string;
  uid: string;
};

export const authRequestContext = new AsyncLocalStorage<AuthRequestContext>();

export function getAuthRequestContext(): AuthRequestContext | null {
  return authRequestContext.getStore() ?? null;
}
