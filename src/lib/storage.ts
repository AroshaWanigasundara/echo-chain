// Per-user localStorage utilities

/**
 * Get a storage key prefixed with user address
 */
export function getUserStorageKey(key: string, address: string): string {
  return `${key}_${address}`;
}

/**
 * Clear all data for a specific user
 */
export function clearUserData(address: string): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.endsWith(`_${address}`)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));
}

/**
 * Get item from user-scoped storage
 */
export function getUserStorageItem(key: string, address: string): string | null {
  return localStorage.getItem(getUserStorageKey(key, address));
}

/**
 * Set item in user-scoped storage
 */
export function setUserStorageItem(key: string, address: string, value: string): void {
  localStorage.setItem(getUserStorageKey(key, address), value);
}

/**
 * Remove item from user-scoped storage
 */
export function removeUserStorageItem(key: string, address: string): void {
  localStorage.removeItem(getUserStorageKey(key, address));
}

// Global (non-user-scoped) storage keys
export const GLOBAL_STORAGE_KEYS = {
  THEME: "messaging_theme",
  RPC_ENDPOINT: "messaging_rpc_endpoint",
} as const;

// User-scoped storage key prefixes
export const USER_STORAGE_KEYS = {
  PRIVATE_KEY: "messaging_private_key",
  PUBLIC_KEY: "messaging_public_key",
  MESSAGES: "messaging_messages",
} as const;
