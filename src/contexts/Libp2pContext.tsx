import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from "react";
import { 
  startLibp2pNode, 
  stopLibp2pNode, 
  isLibp2pRunning, 
  subscribeToInbox, 
  unsubscribeFromInbox,
  publishToInbox,
  getPeerCount,
  P2PMessage 
} from "@/utils/libp2p";
import { useBlockchain } from "@/contexts/BlockchainContext";
import { useEncryption } from "@/contexts/EncryptionContext";
import { StoredMessage } from "@/lib/types";
import { toast } from "@/hooks/use-toast";

interface Libp2pContextType {
  isP2PConnected: boolean;
  isP2PConnecting: boolean;
  peerCount: number;
  
  sendP2PMessage: (message: P2PMessage) => Promise<boolean>;
  initializeP2P: () => Promise<void>;
  shutdownP2P: () => Promise<void>;
}

const Libp2pContext = createContext<Libp2pContextType | null>(null);

export function Libp2pProvider({ children }: { children: ReactNode }) {
  const { walletState, addStoredMessage, messages, fetchUserProfile } = useBlockchain();
  const { decrypt } = useEncryption();
  
  const [isP2PConnected, setIsP2PConnected] = useState(false);
  const [isP2PConnecting, setIsP2PConnecting] = useState(false);
  const [peerCount, setPeerCount] = useState(0);
  
  const currentAddressRef = useRef<string | null>(null);
  const messageHandlerRef = useRef<((message: P2PMessage) => void) | null>(null);

  // Create a stable message handler
  const handleIncomingMessage = useCallback(async (p2pMessage: P2PMessage) => {
    const currentAddress = walletState.address;
    
    if (!currentAddress) {
      console.log('No wallet connected, ignoring P2P message');
      return;
    }

    // Check if message is for us
    if (p2pMessage.recipient !== currentAddress) {
      console.log('Message not for us, ignoring');
      return;
    }

    // Check if message already exists
    const exists = messages.some(m => m.id === p2pMessage.messageId);
    if (exists) {
      console.log('Message already received, skipping:', p2pMessage.messageId);
      return;
    }

    console.log('Processing incoming P2P message:', p2pMessage.messageId);

    // Create stored message
    const receivedMessage: StoredMessage = {
      id: p2pMessage.messageId,
      conversationId: p2pMessage.conversationId,
      sender: p2pMessage.sender,
      recipient: p2pMessage.recipient,
      encryptedData: p2pMessage.encryptedData,
      hash: p2pMessage.messageHash,
      timestamp: p2pMessage.timestamp,
      blockNumber: p2pMessage.blockNumber,
      status: "received",
      direction: "received",
      verified: false,
      expired: false,
      canVerify: true,
      decryptedContent: undefined,
    };

    // Try to decrypt the message
    try {
      // Fetch sender's public key from blockchain
      const senderProfile = await fetchUserProfile(p2pMessage.sender);
      
      if (senderProfile?.publicKey) {
        const decrypted = decrypt(p2pMessage.encryptedData, senderProfile.publicKey);
        receivedMessage.decryptedContent = decrypted;
        console.log('Successfully decrypted P2P message');
      } else {
        receivedMessage.decryptedContent = '[Sender not registered]';
        console.log('Could not decrypt: sender public key not found');
      }
    } catch (decryptError) {
      console.error('Decryption failed:', decryptError);
      receivedMessage.decryptedContent = '[Decryption failed]';
    }

    // Add to message store
    addStoredMessage(receivedMessage);

    // Show notification
    toast({
      title: "New message received",
      description: `From ${p2pMessage.sender.slice(0, 8)}...`,
    });
  }, [walletState.address, messages, addStoredMessage, fetchUserProfile, decrypt]);

  // Update handler ref when dependencies change
  useEffect(() => {
    messageHandlerRef.current = handleIncomingMessage;
  }, [handleIncomingMessage]);

  // Initialize P2P when wallet connects
  const initializeP2P = useCallback(async () => {
    const address = walletState.address;
    
    if (!address) {
      console.log('Cannot initialize P2P: no wallet connected');
      return;
    }

    // Already connected for this address
    if (currentAddressRef.current === address && isP2PConnected) {
      console.log('P2P already initialized for this address');
      return;
    }

    setIsP2PConnecting(true);

    try {
      // Stop existing node if switching accounts
      if (currentAddressRef.current && currentAddressRef.current !== address) {
        await unsubscribeFromInbox(currentAddressRef.current);
        await stopLibp2pNode();
      }

      // Start new node
      await startLibp2pNode(address);
      
      // Subscribe to inbox with a wrapper that uses the ref
      await subscribeToInbox(address, (msg) => {
        if (messageHandlerRef.current) {
          messageHandlerRef.current(msg);
        }
      });

      currentAddressRef.current = address;
      setIsP2PConnected(true);

      toast({
        title: "P2P Connected",
        description: "Real-time messaging enabled",
      });
    } catch (error) {
      console.error('Failed to initialize P2P:', error);
      setIsP2PConnected(false);
      
      toast({
        title: "P2P unavailable",
        description: "Messages will be delivered on recipient login",
        variant: "destructive",
      });
    } finally {
      setIsP2PConnecting(false);
    }
  }, [walletState.address, isP2PConnected]);

  // Shutdown P2P
  const shutdownP2P = useCallback(async () => {
    if (currentAddressRef.current) {
      await unsubscribeFromInbox(currentAddressRef.current);
    }
    await stopLibp2pNode();
    currentAddressRef.current = null;
    setIsP2PConnected(false);
    setPeerCount(0);
  }, []);

  // Send message via P2P
  const sendP2PMessage = useCallback(async (message: P2PMessage): Promise<boolean> => {
    if (!isP2PConnected) {
      console.log('P2P not connected, cannot send');
      return false;
    }

    return await publishToInbox(message.recipient, message);
  }, [isP2PConnected]);

  // Auto-initialize when wallet connects
  useEffect(() => {
    if (walletState.address && walletState.connected) {
      // Small delay to let other contexts initialize
      const timer = setTimeout(() => {
        initializeP2P();
      }, 1000);
      
      return () => clearTimeout(timer);
    } else if (!walletState.connected) {
      shutdownP2P();
    }
  }, [walletState.address, walletState.connected]);

  // Poll for connection status and peer count
  useEffect(() => {
    const interval = setInterval(() => {
      setIsP2PConnected(isLibp2pRunning());
      setPeerCount(getPeerCount());
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    const cleanup = async () => {
      await shutdownP2P();
    };

    window.addEventListener('beforeunload', cleanup);

    return () => {
      window.removeEventListener('beforeunload', cleanup);
      cleanup();
    };
  }, [shutdownP2P]);

  const value: Libp2pContextType = {
    isP2PConnected,
    isP2PConnecting,
    peerCount,
    sendP2PMessage,
    initializeP2P,
    shutdownP2P,
  };

  return (
    <Libp2pContext.Provider value={value}>
      {children}
    </Libp2pContext.Provider>
  );
}

export function useLibp2p() {
  const context = useContext(Libp2pContext);
  if (!context) {
    throw new Error("useLibp2p must be used within Libp2pProvider");
  }
  return context;
}
