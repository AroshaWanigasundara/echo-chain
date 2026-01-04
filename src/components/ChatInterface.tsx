import { motion, AnimatePresence } from "framer-motion";
import { Send, Lock, ArrowLeft, RefreshCw, Loader2, Filter, ShieldCheck } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBlockchain } from "@/contexts/BlockchainContext";
import { useEncryption } from "@/contexts/EncryptionContext";
import { MessageBubble } from "@/components/MessageBubble";
import { VerificationModal } from "@/components/VerificationModal";
import { truncateKey } from "@/lib/encryption";
import { ChatMessage, StoredMessage, MessageVerificationResult } from "@/lib/types";
import { toast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MESSAGE_HASH_EXPIRY_BLOCKS, BLOCKS_PER_DAY, BLOCKS_PER_HOUR } from "@/lib/constants";

interface ChatInterfaceProps {
  contactAddress: string | null;
  onBack: () => void;
}

type MessageFilter = "all" | "verified" | "unverified" | "expired";

// Helper to create conversation ID
function createConversationId(addr1: string, addr2: string): string {
  return [addr1, addr2].sort().join("_");
}

export function ChatInterface({ contactAddress, onBack }: ChatInterfaceProps) {
  const { 
    walletState, 
    blockchainState,
    messages, 
    sendMessageHash, 
    addStoredMessage, 
    updateMessageStatus,
    fetchUserProfile,
    verifyMessageOnChain
  } = useBlockchain();
  const { encrypt, hash, publicKey } = useEncryption();
  
  const [messageInput, setMessageInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [recipientPublicKey, setRecipientPublicKey] = useState<string | null>(null);
  const [isLoadingRecipient, setIsLoadingRecipient] = useState(false);
  const [filter, setFilter] = useState<MessageFilter>("all");
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [verifyingMessageId, setVerifyingMessageId] = useState<string | null>(null);
  const [isVerifyingAll, setIsVerifyingAll] = useState(false);
  
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

  // Get conversation ID
  const conversationId = walletState.address && contactAddress 
    ? createConversationId(walletState.address, contactAddress)
    : null;

  // Filter messages for this conversation
  const conversationMessages: ChatMessage[] = messages
    .filter((m) => {
      // Filter by conversation
      const msgConversationId = m.conversationId || createConversationId(m.sender, m.recipient);
      if (msgConversationId !== conversationId) return false;
      
      // Apply filter
      switch (filter) {
        case "verified":
          return m.verified === true;
        case "unverified":
          return m.verified !== true && m.expired !== true;
        case "expired":
          return m.expired === true;
        default:
          return true;
      }
    })
    .map((m) => {
      let content = m.decryptedContent || "";
      
      // Try to decrypt if we haven't already
      if (!content && m.encryptedData && m.sender !== walletState.address) {
        content = "[Encrypted message]";
      }
      
      const isMine = m.sender === walletState.address;
      
      return {
        id: m.id,
        content,
        sender: m.sender,
        recipient: m.recipient,
        timestamp: m.timestamp,
        isMine,
        status: m.status,
        encrypted: true,
        hash: m.hash,
        blockNumber: m.blockNumber,
        verified: m.verified ?? false,
        expired: m.expired ?? false,
        verifiedAt: m.verifiedAt,
        conversationId: m.conversationId,
        // Only recipients can verify messages (not the sender)
        canVerify: !isMine && !m.expired && m.status !== "sending" && m.status !== "failed",
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
      
      // Create conversation ID
      const convId = createConversationId(walletState.address, contactAddress);
      
      // Create local message first
      const tempId = `temp_${Date.now()}`;
      const storedMessage: StoredMessage = {
        id: tempId,
        conversationId: convId,
        sender: walletState.address,
        recipient: contactAddress,
        encryptedData,
        hash: messageHash,
        timestamp: Date.now(),
        status: "sending",
        decryptedContent: content,
        direction: "sent",
        verified: true,  // Sender's messages are auto-verified
        expired: false,
        canVerify: false, // Sender cannot verify their own messages
      };
      
      addStoredMessage(storedMessage);
      
      // Send hash to blockchain
      const { messageId, blockNumber } = await sendMessageHash(contactAddress, messageHash);
      
      // Update message with blockchain ID and status
      updateMessageStatus(tempId, "sent", blockNumber, messageId);
      
      toast({
        title: "Message sent",
        description: "Hash stored on blockchain",
      });
      
    } catch (error) {
      console.error("Failed to send message:", error);
      toast({
        title: "Failed to send",
        description: error instanceof Error ? error.message : "Message could not be sent",
        variant: "destructive",
      });
      updateMessageStatus(`temp_${Date.now() - 1}`, "failed");
    } finally {
      setIsSending(false);
    }
  }, [messageInput, contactAddress, walletState.address, recipientPublicKey, encrypt, hash, addStoredMessage, sendMessageHash, updateMessageStatus]);

  const handleVerifyMessage = async (message: ChatMessage): Promise<MessageVerificationResult> => {
    if (!verifyMessageOnChain) {
      return { verified: false, expired: false, error: "Verification not available" };
    }
    
    setVerifyingMessageId(message.id);
    
    try {
      const result = await verifyMessageOnChain(message.id, message.hash || "");
      
      // Update message status in storage
      if (result.verified) {
        updateMessageStatus(message.id, "verified", undefined, undefined, {
          verified: true,
          expired: result.expired,
          verifiedAt: Date.now(),
        });
      } else if (result.expired) {
        updateMessageStatus(message.id, message.status, undefined, undefined, {
          verified: false,
          expired: true,
        });
      }
      
      return result;
    } finally {
      setVerifyingMessageId(null);
    }
  };

  const handleMessageClick = (message: ChatMessage) => {
    setSelectedMessage(message);
    setIsVerificationModalOpen(true);
  };

  const handleVerifyAll = async () => {
    const unverifiedMessages = conversationMessages.filter(
      m => !m.verified && !m.expired && m.status !== "sending" && m.status !== "failed"
    );
    
    if (unverifiedMessages.length === 0) {
      toast({
        title: "No messages to verify",
        description: "All messages are already verified or expired",
      });
      return;
    }
    
    setIsVerifyingAll(true);
    let verified = 0;
    let failed = 0;
    let expired = 0;
    
    for (const msg of unverifiedMessages) {
      try {
        const result = await handleVerifyMessage(msg);
        if (result.verified) verified++;
        else if (result.expired) expired++;
        else failed++;
      } catch {
        failed++;
      }
    }
    
    setIsVerifyingAll(false);
    
    toast({
      title: "Batch verification complete",
      description: `${verified} verified, ${expired} expired, ${failed} failed`,
    });
  };

  const filterLabels: Record<MessageFilter, string> = {
    all: "All Messages",
    verified: "Verified Only",
    unverified: "Unverified",
    expired: "Expired",
  };

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
        
        {/* Filter Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0">
              <Filter className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(Object.keys(filterLabels) as MessageFilter[]).map((f) => (
              <DropdownMenuItem
                key={f}
                onClick={() => setFilter(f)}
                className={filter === f ? "bg-primary/10" : ""}
              >
                {filterLabels[f]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        
        {/* Verify All Button */}
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={handleVerifyAll}
          disabled={isVerifyingAll}
          title="Verify all messages"
        >
          {isVerifyingAll ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ShieldCheck className="h-4 w-4" />
          )}
        </Button>
        
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
        <div className="space-y-6">
          <AnimatePresence mode="popLayout">
            {conversationMessages.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12 text-muted-foreground"
              >
                <Lock className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">
                  {filter !== "all" 
                    ? `No ${filterLabels[filter].toLowerCase()} messages`
                    : "Start a secure conversation"
                  }
                </p>
                <p className="text-xs mt-1">Messages are encrypted end-to-end</p>
              </motion.div>
            ) : (
              conversationMessages.map((message) => (
                <MessageBubble 
                  key={message.id} 
                  message={message}
                  currentBlockNumber={blockchainState.blockNumber}
                  onVerifyClick={handleMessageClick}
                  isVerifying={verifyingMessageId === message.id}
                />
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

      {/* Verification Modal */}
      <VerificationModal
        message={selectedMessage}
        isOpen={isVerificationModalOpen}
        onClose={() => {
          setIsVerificationModalOpen(false);
          setSelectedMessage(null);
        }}
        onVerify={handleVerifyMessage}
      />
    </motion.div>
  );
}