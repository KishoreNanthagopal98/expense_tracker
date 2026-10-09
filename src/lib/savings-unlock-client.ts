export const SAVINGS_UNLOCK_STORAGE_KEY = "et_savings_unlock";
export const SAVINGS_UNLOCK_HEADER = "X-Savings-Unlock";

export function readSavingsUnlockToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(SAVINGS_UNLOCK_STORAGE_KEY);
}

export function writeSavingsUnlockToken(token: string) {
  sessionStorage.setItem(SAVINGS_UNLOCK_STORAGE_KEY, token);
}

export function clearSavingsUnlockToken() {
  sessionStorage.removeItem(SAVINGS_UNLOCK_STORAGE_KEY);
}

export function savingsUnlockHeaders(): HeadersInit {
  const token = readSavingsUnlockToken();
  if (!token) return {};
  return { [SAVINGS_UNLOCK_HEADER]: token };
}
