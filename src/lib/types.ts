export interface UserProfile {
  address: string;
  publicKey: string;
  registeredAt?: number;
  bondPaid: boolean;
}

export interface Contact {
  address: string;
  nickname?: string;
  publicKey?: string;
  status: "pending" | "active" | "blocked";
  addedAt: number;
  approvedByMe: boolean;
  approvedByThem: boolean;
}

export interface StoredMessage {
  id: string;
  conversationId: string;  // `${addr1}_${addr2}` sorted alphabetically
  sender: string;
  recipient: string;
  encryptedData: {
    ciphertext: string;
    nonce: string;
  };
  hash: string;
  timestamp: number;
  status: "sending" | "sent" | "verified" | "failed";
  blockNumber?: number;
  decryptedContent?: string;
  direction: "sent" | "received";
  verified: boolean;
  expired: boolean;
  verifiedAt?: number;
}

export interface ChatMessage {
  id: string;
  content: string;
  sender: string;
  recipient: string;
  timestamp: number;
  isMine: boolean;
  status: "sending" | "sent" | "verified" | "failed";
  encrypted: boolean;
  hash?: string;
  blockNumber?: number;
  verified: boolean;
  expired: boolean;
  verifiedAt?: number;
  conversationId?: string;
}

export interface BlockchainState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  blockNumber: number;
}

export interface WalletState {
  connected: boolean;
  address: string | null;
  balance: string | null;
  accounts: { address: string; meta: { name?: string } }[];
}

export interface MessageVerificationResult {
  verified: boolean;
  expired: boolean;
  blockchainHash?: string;
  computedHash?: string;
  blockNumber?: number;
  blocksRemaining?: number;
  daysRemaining?: number;
  error?: string;
}

export type Theme = "dark" | "light";
