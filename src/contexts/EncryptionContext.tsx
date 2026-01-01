import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { STORAGE_KEYS } from "@/lib/constants";
import { 
  generateKeyPair, 
  keyToHex, 
  hexToKey, 
  encryptMessage, 
  decryptMessage, 
  hashMessage,
  type KeyPair,
  type EncryptedMessage 
} from "@/lib/encryption";
import { toast } from "@/hooks/use-toast";

interface EncryptionContextType {
  publicKey: string | null;
  hasKeys: boolean;
  isGenerating: boolean;
  
  generateKeys: () => Promise<{ publicKey: string; privateKey: string }>;
  importKeys: (privateKeyHex: string) => boolean;
  exportPrivateKey: () => string | null;
  clearKeys: () => void;
  
  encrypt: (message: string, recipientPublicKeyHex: string) => EncryptedMessage;
  decrypt: (encrypted: EncryptedMessage, senderPublicKeyHex: string) => string;
  hash: (data: string) => Promise<string>;
}

const EncryptionContext = createContext<EncryptionContextType | null>(null);

export function EncryptionProvider({ children }: { children: ReactNode }) {
  const [keyPair, setKeyPair] = useState<KeyPair | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Load keys from localStorage on mount
  useEffect(() => {
    const storedPrivateKey = localStorage.getItem(STORAGE_KEYS.PRIVATE_KEY);
    const storedPublicKey = localStorage.getItem(STORAGE_KEYS.PUBLIC_KEY);
    
    if (storedPrivateKey && storedPublicKey) {
      try {
        const secretKey = hexToKey(storedPrivateKey);
        const pubKey = hexToKey(storedPublicKey);
        setKeyPair({ publicKey: pubKey, secretKey });
        setPublicKey(storedPublicKey);
      } catch (e) {
        console.error("Failed to load stored keys:", e);
        localStorage.removeItem(STORAGE_KEYS.PRIVATE_KEY);
        localStorage.removeItem(STORAGE_KEYS.PUBLIC_KEY);
      }
    }
  }, []);

  const generateKeys = useCallback(async () => {
    setIsGenerating(true);
    
    try {
      // Small delay for UX
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      const newKeyPair = generateKeyPair();
      const publicKeyHex = keyToHex(newKeyPair.publicKey);
      const privateKeyHex = keyToHex(newKeyPair.secretKey);
      
      // Store keys
      localStorage.setItem(STORAGE_KEYS.PRIVATE_KEY, privateKeyHex);
      localStorage.setItem(STORAGE_KEYS.PUBLIC_KEY, publicKeyHex);
      
      setKeyPair(newKeyPair);
      setPublicKey(publicKeyHex);
      
      toast({
        title: "Keys generated",
        description: "Your encryption keys have been generated securely",
      });
      
      return { publicKey: publicKeyHex, privateKey: privateKeyHex };
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const importKeys = useCallback((privateKeyHex: string): boolean => {
    try {
      if (privateKeyHex.length !== 128) {
        throw new Error("Invalid private key length");
      }
      
      const secretKey = hexToKey(privateKeyHex);
      // Derive public key from secret key (first 32 bytes of 64-byte secret key is not the public key for nacl.box)
      // We need to regenerate the keypair or store both keys
      // For NaCl box, we need to store the public key separately
      
      // Since nacl.box.keyPair.fromSecretKey expects 32-byte seed, we handle this differently
      // For simplicity, require both keys to be stored
      toast({
        title: "Import failed",
        description: "Please use the backup file with both keys",
        variant: "destructive",
      });
      return false;
    } catch (error) {
      console.error("Failed to import keys:", error);
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Invalid key format",
        variant: "destructive",
      });
      return false;
    }
  }, []);

  const exportPrivateKey = useCallback((): string | null => {
    if (!keyPair) return null;
    return keyToHex(keyPair.secretKey);
  }, [keyPair]);

  const clearKeys = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.PRIVATE_KEY);
    localStorage.removeItem(STORAGE_KEYS.PUBLIC_KEY);
    setKeyPair(null);
    setPublicKey(null);
    
    toast({
      title: "Keys cleared",
      description: "Your encryption keys have been removed",
    });
  }, []);

  const encrypt = useCallback((message: string, recipientPublicKeyHex: string): EncryptedMessage => {
    if (!keyPair) {
      throw new Error("No encryption keys available");
    }
    
    const recipientPublicKey = hexToKey(recipientPublicKeyHex);
    return encryptMessage(message, recipientPublicKey, keyPair.secretKey);
  }, [keyPair]);

  const decrypt = useCallback((encrypted: EncryptedMessage, senderPublicKeyHex: string): string => {
    if (!keyPair) {
      throw new Error("No encryption keys available");
    }
    
    const senderPublicKey = hexToKey(senderPublicKeyHex);
    return decryptMessage(encrypted, senderPublicKey, keyPair.secretKey);
  }, [keyPair]);

  const hash = useCallback(async (data: string): Promise<string> => {
    return hashMessage(data);
  }, []);

  const value: EncryptionContextType = {
    publicKey,
    hasKeys: keyPair !== null,
    isGenerating,
    generateKeys,
    importKeys,
    exportPrivateKey,
    clearKeys,
    encrypt,
    decrypt,
    hash,
  };

  return (
    <EncryptionContext.Provider value={value}>
      {children}
    </EncryptionContext.Provider>
  );
}

export function useEncryption() {
  const context = useContext(EncryptionContext);
  if (!context) {
    throw new Error("useEncryption must be used within EncryptionProvider");
  }
  return context;
}
