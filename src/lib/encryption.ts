import nacl from "tweetnacl";
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from "tweetnacl-util";
import { sha256 } from "js-sha256";

export interface KeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export interface EncryptedMessage {
  ciphertext: string;
  nonce: string;
}

/**
 * Generate a new NaCl box key pair for encryption
 */
export function generateKeyPair(): KeyPair {
  return nacl.box.keyPair();
}

/**
 * Convert key to hex string for display
 */
export function keyToHex(key: Uint8Array): string {
  return Array.from(key)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Remove 0x prefix from hex string if present
 */
export function removeHexPrefix(hex: string): string {
  return hex.startsWith("0x") ? hex.slice(2) : hex;
}

/**
 * Convert hex string back to Uint8Array
 */
export function hexToKey(hex: string): Uint8Array {
  const cleanHex = removeHexPrefix(hex);
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Truncate key for display (first 8 + last 8 chars)
 */
export function truncateKey(key: string): string {
  if (key.length <= 16) return key;
  return `${key.slice(0, 8)}...${key.slice(-8)}`;
}

/**
 * Encrypt a message using the recipient's public key
 */
export function encryptMessage(
  message: string,
  recipientPublicKey: Uint8Array,
  senderSecretKey: Uint8Array
): EncryptedMessage {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const messageUint8 = decodeUTF8(message);
  
  const encrypted = nacl.box(
    messageUint8,
    nonce,
    recipientPublicKey,
    senderSecretKey
  );

  if (!encrypted) {
    throw new Error("Encryption failed");
  }

  return {
    ciphertext: encodeBase64(encrypted),
    nonce: encodeBase64(nonce),
  };
}

/**
 * Decrypt a message using the sender's public key and own secret key
 */
export function decryptMessage(
  encryptedMessage: EncryptedMessage,
  senderPublicKey: Uint8Array,
  recipientSecretKey: Uint8Array
): string {
  const ciphertext = decodeBase64(encryptedMessage.ciphertext);
  const nonce = decodeBase64(encryptedMessage.nonce);

  const decrypted = nacl.box.open(
    ciphertext,
    nonce,
    senderPublicKey,
    recipientSecretKey
  );

  if (!decrypted) {
    throw new Error("Decryption failed - message may be tampered");
  }

  return encodeUTF8(decrypted);
}

/**
 * Hash encrypted message data using SHA-256
 */
export function hashMessage(data: string): string {
  const hash = sha256(data);
  return "0x" + hash;
}

/**
 * Encode public key to Vec<u8> format for blockchain
 */
export function publicKeyToVec(publicKey: Uint8Array): number[] {
  return Array.from(publicKey);
}

/**
 * Verify a message hash matches
 */
export function verifyHash(
  encryptedData: EncryptedMessage,
  expectedHash: string
): boolean {
  const computedHash = hashMessage(encryptedData.ciphertext + encryptedData.nonce);
  return computedHash === expectedHash;
}
