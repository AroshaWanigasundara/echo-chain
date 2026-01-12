import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useBlockchain } from "./BlockchainContext";
import { useEncryption } from "./EncryptionContext";
import { 
  initializePubNub, 
  cleanupPubNub, 
  subscribeToInbox, 
  publishMessage,
  isPubNubConnected,
  addStatusListener,
  removeStatusListener,
  fetchMessageHistory,
  PubNubMessage
} from "@/utils/pubnub";
import { StoredMessage } from "@/lib/types";
import { toast } from "@/hooks/use-toast";
import { truncateKey } from "@/lib/encryption";

interface PubnubContextType {
  isConnected: boolean;
  sendP2PMessage: (message: PubNubMessage) => Promise<void>;
}

const PubnubContext = createContext<PubnubContextType | null>(null);

export function PubnubProvider({ children }: { children: ReactNode }) {
  const { walletState, addStoredMessage, fetchUserProfile, messages } = useBlockchain();
  const { decrypt } = useEncryption();
  const [isConnected, setIsConnected] = useState(false);

  // Handle incoming PubNub messages
  const handleIncomingMessage = useCallback(async (messageData: PubNubMessage) => {
    try {
      console.log('📨 Processing incoming message:', messageData.messageId);
      
      // Check if message already exists
      const exists = messages.some(m => m.id === messageData.messageId);
      if (exists) {
        console.log('Message already exists, skipping');
        return;
      }

      // Create the stored message
      const receivedMessage: StoredMessage = {
        id: messageData.messageId,
        conversationId: messageData.conversationId,
        sender: messageData.sender,
        recipient: messageData.recipient,
        encryptedData: {
          ciphertext: '',
          nonce: ''
        },
        hash: messageData.messageHash,
        timestamp: messageData.timestamp,
        status: "sent",
        blockNumber: messageData.blockNumber,
        decryptedContent: undefined,
        direction: "received",
        verified: false,
        expired: false,
        canVerify: true
      };

      // Try to decrypt
      try {
        // Fetch sender's public key
        const senderProfile = await fetchUserProfile(messageData.sender);
        
        if (senderProfile?.publicKey) {
          const decrypted = decrypt(
            {
              ciphertext: String.fromCharCode(...messageData.encryptedData),
              nonce: String.fromCharCode(...messageData.nonce)
            },
            senderProfile.publicKey
          );
          
          receivedMessage.decryptedContent = decrypted;
        } else {
          receivedMessage.decryptedContent = '[Sender public key not found]';
        }
      } catch (decryptError) {
        console.error('Decryption failed:', decryptError);
        receivedMessage.decryptedContent = '[Decryption failed]';
      }

      // Store the message
      addStoredMessage(receivedMessage);

      // Show notification
      toast({
        title: "New message",
        description: `From ${truncateKey(messageData.sender)}`,
      });

    } catch (error) {
      console.error('Failed to handle incoming PubNub message:', error);
    }
  }, [messages, addStoredMessage, fetchUserProfile, decrypt]);

  // Initialize PubNub when wallet connects
  useEffect(() => {
    if (!walletState.address) {
      cleanupPubNub();
      setIsConnected(false);
      return;
    }

    try {
      initializePubNub(walletState.address);
      subscribeToInbox(walletState.address, handleIncomingMessage);
      
      // Listen for connection status changes
      const statusHandler = (connected: boolean) => {
        setIsConnected(connected);
      };
      
      addStatusListener(statusHandler);
      
      // Check initial status
      setIsConnected(isPubNubConnected());

      return () => {
        removeStatusListener(statusHandler);
      };
    } catch (error) {
      console.error('Failed to initialize PubNub:', error);
      toast({
        title: "P2P messaging unavailable",
        description: "Messages will be delivered on recipient's next login",
        variant: "destructive",
      });
    }
  }, [walletState.address, handleIncomingMessage]);

  // Fetch message history when user connects (for offline message delivery)
  useEffect(() => {
    if (!walletState.address || !walletState.connected) return;

    const fetchHistory = async () => {
      try {
        const historicalMessages = await fetchMessageHistory(walletState.address);
        
        // Process each historical message
        for (const messageData of historicalMessages) {
          // Check if message already exists
          const exists = messages.some(m => m.id === messageData.messageId);
          if (exists) {
            console.log('Historical message already exists, skipping');
            continue;
          }

          // Create the stored message
          const receivedMessage: StoredMessage = {
            id: messageData.messageId,
            conversationId: messageData.conversationId,
            sender: messageData.sender,
            recipient: messageData.recipient,
            encryptedData: {
              ciphertext: '',
              nonce: ''
            },
            hash: messageData.messageHash,
            timestamp: messageData.timestamp,
            status: "sent",
            blockNumber: messageData.blockNumber,
            decryptedContent: undefined,
            direction: "received",
            verified: false,
            expired: false,
            canVerify: true
          };

          // Try to decrypt
          try {
            const senderProfile = await fetchUserProfile(messageData.sender);
            
            if (senderProfile?.publicKey) {
              const decrypted = decrypt(
                {
                  ciphertext: String.fromCharCode(...messageData.encryptedData),
                  nonce: String.fromCharCode(...messageData.nonce)
                },
                senderProfile.publicKey
              );
              
              receivedMessage.decryptedContent = decrypted;
            } else {
              receivedMessage.decryptedContent = '[Sender public key not found]';
            }
          } catch (decryptError) {
            console.error('Decryption failed:', decryptError);
            receivedMessage.decryptedContent = '[Decryption failed]';
          }

          // Store the message
          addStoredMessage(receivedMessage);
        }
      } catch (error) {
        console.error('Failed to fetch message history:', error);
      }
    };

    // Fetch history after a short delay to ensure connection is ready
    const timer = setTimeout(fetchHistory, 500);
    return () => clearTimeout(timer);
  }, [walletState.address, walletState.connected, messages, addStoredMessage, fetchUserProfile, decrypt]);

  // Cleanup on window close
  useEffect(() => {
    const cleanup = () => cleanupPubNub();
    window.addEventListener('beforeunload', cleanup);
    return () => {
      window.removeEventListener('beforeunload', cleanup);
      cleanup();
    };
  }, []);

  const sendP2PMessage = useCallback(async (message: PubNubMessage) => {
    try {
      await publishMessage(message.recipient, message);
      console.log('✓ Message delivered via PubNub');
    } catch (error) {
      console.error('PubNub delivery failed:', error);
      // Don't throw - P2P is optional, blockchain is primary
    }
  }, []);

  return (
    <PubnubContext.Provider value={{ isConnected, sendP2PMessage }}>
      {children}
    </PubnubContext.Provider>
  );
}

export function usePubnub() {
  const context = useContext(PubnubContext);
  if (!context) {
    throw new Error("usePubnub must be used within a PubnubProvider");
  }
  return context;
}
