// Blockchain configuration
export const RPC_ENDPOINT = "ws://62.169.26.99:9946";
export const SPAM_BOND = BigInt("10000000000000"); // 10 UNIT
export const MAX_CONTACTS = 1000;
export const MESSAGE_HASH_EXPIRY_DAYS = 7;

// App info
export const APP_NAME = "SecureChain Messenger";
export const APP_VERSION = "1.0.0";

// Legacy storage keys (deprecated - use storage.ts utilities instead)
export const STORAGE_KEYS = {
  PRIVATE_KEY: "messaging_private_key",
  PUBLIC_KEY: "messaging_public_key",
  MESSAGES: "messaging_messages",
  THEME: "messaging_theme",
} as const;
