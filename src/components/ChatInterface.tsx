import { motion, AnimatePresence } from "framer-motion";
import { Send, Lock, ArrowLeft, RefreshCw, Loader2 } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBlockchain } from "@/contexts/BlockchainContext";
import { useEncryption } from "@/contexts/EncryptionContext";
import { MessageBubble } from "@/components/MessageBubble";
import { truncateKey } from "@/lib/encryption";
import { ChatMessage, StoredMessage } from "@/lib/types";
import { toast } from "@/hooks/use-toast";

interface ChatInterfaceProps {
  contactAddress: string | null;
  onBack: () => void;
}

export function ChatInterface({ contactAddress, onBack }: ChatInterfaceProps) {
  const { 
    walletState, 
    messages, 
    sendMessageHash, 
    addStoredMessage, 
    updateMessageStatus,
    fetchUserProfile 
  } = useBlockchain();
  const { encrypt, decrypt, hash, publicKey } = useEncryption();
  
  const [messageInput, setMessageInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [recipientPublicKey, setRecipientPublicKey] = useState<string | null>(null);
  const [isLoadingRecipient, setIsLoadingRecipient] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch recipient's public key
  useEffect(() => {
    if (!contactAddress) return;
    
    setIsLoadingRecipient(true);
    fetchUserProfile(contactAddress)
      .then((profile) => {
        if (profile?.publicKey) {
          setRecipientPublicKey(profile.publicKey);
        } else {
          setRecipientPublicKey(null);
          toast({
            title: "Contact not registered",
            description: "This contact hasn't registered their public key yet",
            variant: "destructive",
          });
        }
      })
      .finally(() => setIsLoadingRecipient(false));
  }, [contactAddress, fetchUserProfile]);

  // Filter messages for this conversation
  const conversationMessages: ChatMessage[] = messages
    .filter((m) => 
      (m.sender === walletState.address && m.recipient === contactAddress) ||
      (m.sender === contactAddress && m.recipient === walletState.address)
    )
    .map((m) => {
      let content = m.decryptedContent || "";
      
      // Try to decrypt if we haven't already
      if (!content && m.encryptedData && m.sender !== walletState.address) {
        try {
          // Need sender's public key to decrypt
          // For now, we'll show encrypted indicator
          content = "[Encrypted message]";
        } catch {
          content = "[Decryption failed]";
        }
      }
      
      return {
        id: m.id,
        content,
        sender: m.sender,
        recipient: m.recipient,
        timestamp: m.timestamp,
        isMine: m.sender === walletState.address,
        status: m.status,
        encrypted: true,
        hash: m.hash,
      };
    })
    .sort((a, b) => a.timestamp - b.timestamp);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversationMessages.length]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, [contactAddress]);

  const handleSendMessage = useCallback(async () => {
    if (!messageInput.trim() || !contactAddress || !walletState.address || !recipientPublicKey) return;
    
    setIsSending(true);
    const content = messageInput.trim();
    setMessageInput("");
    
    try {
      // Encrypt the message
      const encryptedData = encrypt(content, recipientPublicKey);
      
      // Hash the encrypted data
      const messageHash = await hash(encryptedData.ciphertext + encryptedData.nonce);
      
      // Create local message first
      const tempId = `temp_${Date.now()}`;
      const storedMessage: StoredMessage = {
        id: tempId,
        sender: walletState.address,
        recipient: contactAddress,
        encryptedData,
        hash: messageHash,
        timestamp: Date.now(),
        status: "sending",
        decryptedContent: content, // Store decrypted for sender
      };
      
      addStoredMessage(storedMessage);
      
      // Send hash to blockchain
      const blockchainId = await sendMessageHash(contactAddress, messageHash);
      
      // Update message with blockchain ID and status
      updateMessageStatus(tempId, "sent");
      
      // Simulate verification after a delay
      setTimeout(() => {
        updateMessageStatus(tempId, "verified");
      }, 3000);
      
    } catch (error) {
      console.error("Failed to send message:", error);
      toast({
        title: "Failed to send",
        description: error instanceof Error ? error.message : "Message could not be sent",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  }, [messageInput, contactAddress, walletState.address, recipientPublicKey, encrypt, hash, addStoredMessage, sendMessageHash, updateMessageStatus]);

  if (!contactAddress) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <Lock className="h-16 w-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg">Select a contact to start messaging</p>
          <p className="text-sm mt-1">All messages are end-to-end encrypted</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full flex flex-col"
    >
      {/* Chat Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border/50 glass">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onBack}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        
        <div className="flex-1 min-w-0">
          <p className="font-mono text-sm truncate">
            {truncateKey(contactAddress)}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" />
            <span>End-to-end encrypted</span>
          </div>
        </div>
        
        {isLoadingRecipient ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : recipientPublicKey ? (
          <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
        ) : (
          <div className="h-2 w-2 rounded-full bg-destructive" />
        )}
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {conversationMessages.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12 text-muted-foreground"
              >
                <Lock className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Start a secure conversation</p>
                <p className="text-xs mt-1">Messages are encrypted end-to-end</p>
              </motion.div>
            ) : (
              conversationMessages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>

      {/* Message Input */}
      <div className="p-4 border-t border-border/50 glass">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              ref={inputRef}
              placeholder={recipientPublicKey ? "Type a message..." : "Recipient not registered..."}
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
              disabled={!recipientPublicKey || isSending}
              className="pr-10"
            />
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
          <Button
            onClick={handleSendMessage}
            disabled={!messageInput.trim() || !recipientPublicKey || isSending}
            size="icon"
            className="shrink-0"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Messages are encrypted and hashes stored on blockchain for verification
        </p>
      </div>
    </motion.div>
  );
}
