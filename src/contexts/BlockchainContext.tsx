import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from "react";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { web3Enable, web3Accounts, web3FromAddress } from "@polkadot/extension-dapp";
import { RPC_ENDPOINT, APP_NAME, SPAM_BOND, MESSAGE_HASH_EXPIRY_BLOCKS, BLOCKS_PER_DAY, BLOCKS_PER_HOUR } from "@/lib/constants";
import { BlockchainState, WalletState, UserProfile, Contact, StoredMessage, MessageVerificationResult } from "@/lib/types";
import { toast } from "@/hooks/use-toast";
import { getUserStorageKey, USER_STORAGE_KEYS } from "@/lib/storage";
import { truncateKey, hashMessage } from "@/lib/encryption";

interface BlockchainContextType {
  api: ApiPromise | null;
  blockchainState: BlockchainState;
  walletState: WalletState;
  userProfile: UserProfile | null;
  contacts: Contact[];
  messages: StoredMessage[];
  contactsLoading: boolean;
  
  // Wallet functions
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  selectAccount: (address: string) => void;
  
  // Profile functions
  registerProfile: (publicKey: Uint8Array) => Promise<void>;
  updateProfile: (publicKey: Uint8Array) => Promise<string>;
  fetchUserProfile: (address: string) => Promise<UserProfile | null>;
  
  // Contact functions
  addContact: (address: string) => Promise<void>;
  approveContact: (address: string) => Promise<void>;
  removeContact: (address: string) => Promise<void>;
  fetchContacts: () => Promise<void>;
  refreshContacts: () => Promise<void>;
  isContactApproved: (address: string) => Promise<boolean>;
  
  // Message functions
  sendMessageHash: (recipient: string, hash: string) => Promise<{ messageId: string; blockNumber: number }>;
  fetchMessageHashes: () => Promise<void>;
  addStoredMessage: (message: StoredMessage) => void;
  updateMessageStatus: (
    id: string, 
    status: StoredMessage["status"], 
    blockNumber?: number, 
    newId?: string,
    updates?: Partial<StoredMessage>
  ) => void;
  verifyMessageOnChain: (messageId: string, localHash: string) => Promise<MessageVerificationResult>;
}

const BlockchainContext = createContext<BlockchainContextType | null>(null);

export function BlockchainProvider({ children }: { children: ReactNode }) {
  const [api, setApi] = useState<ApiPromise | null>(null);
  const [blockchainState, setBlockchainState] = useState<BlockchainState>({
    connected: false,
    connecting: true,
    error: null,
    blockNumber: 0,
  });
  const [walletState, setWalletState] = useState<WalletState>({
    connected: false,
    address: null,
    balance: null,
    accounts: [],
  });
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  
  // Track previous address for account switch detection
  const previousAddressRef = useRef<string | null>(null);

  // Initialize API connection
  useEffect(() => {
    let mounted = true;
    let apiInstance: ApiPromise | null = null;

    const connectToChain = async () => {
      try {
        setBlockchainState((prev) => ({ ...prev, connecting: true, error: null }));
        
        const provider = new WsProvider(RPC_ENDPOINT);
        apiInstance = await ApiPromise.create({ provider });
        
        if (!mounted) return;
        
        setApi(apiInstance);
        setBlockchainState((prev) => ({
          ...prev,
          connected: true,
          connecting: false,
        }));

        // Subscribe to new blocks
        await apiInstance.rpc.chain.subscribeNewHeads((header) => {
          if (mounted) {
            setBlockchainState((prev) => ({
              ...prev,
              blockNumber: header.number.toNumber(),
            }));
          }
        });

        toast({
          title: "Connected to blockchain",
          description: `Connected to ${RPC_ENDPOINT}`,
        });
      } catch (error) {
        console.error("Failed to connect to blockchain:", error);
        if (mounted) {
          setBlockchainState({
            connected: false,
            connecting: false,
            error: error instanceof Error ? error.message : "Connection failed",
            blockNumber: 0,
          });
          toast({
            title: "Connection failed",
            description: "Failed to connect to blockchain. Please check the RPC endpoint.",
            variant: "destructive",
          });
        }
      }
    };

    connectToChain();

    return () => {
      mounted = false;
      apiInstance?.disconnect();
    };
  }, []);

  // Track if we're in the middle of an account switch to prevent overwriting messages
  const isAccountSwitchingRef = useRef(false);

  // Load messages from user-scoped localStorage
  useEffect(() => {
    if (!walletState.address) {
      setMessages([]);
      return;
    }
    
    // Mark that we're loading (not switching away)
    isAccountSwitchingRef.current = false;
    
    const storageKey = getUserStorageKey(USER_STORAGE_KEYS.MESSAGES, walletState.address);
    const stored = localStorage.getItem(storageKey);
    
    console.log(`Loading messages for ${walletState.address}:`, stored ? JSON.parse(stored).length : 0, 'messages');
    
    if (stored) {
      try {
        setMessages(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse stored messages:", e);
        setMessages([]);
      }
    } else {
      setMessages([]);
    }
  }, [walletState.address]);

  // Save messages to user-scoped localStorage - but NEVER overwrite with empty array during account switch
  useEffect(() => {
    if (!walletState.address) return;
    
    // Don't save empty messages if we're switching accounts (would overwrite existing data)
    if (messages.length === 0 && isAccountSwitchingRef.current) {
      console.log('Skipping save: account switching with empty messages');
      return;
    }
    
    const storageKey = getUserStorageKey(USER_STORAGE_KEYS.MESSAGES, walletState.address);
    console.log(`Saving ${messages.length} messages for ${walletState.address}`);
    
    localStorage.setItem(storageKey, JSON.stringify(messages));
  }, [messages, walletState.address]);

  // Update balance when address changes
  useEffect(() => {
    if (!api || !walletState.address) return;

    let unsubscribe: (() => void) | undefined;

    const subscribeBalance = async () => {
      try {
        const unsub = await api.query.system.account(
          walletState.address!,
          ({ data: { free } }: { data: { free: { toString: () => string } } }) => {
            const balanceInUnit = (BigInt(free.toString()) / BigInt(10 ** 12)).toString();
            setWalletState((prev) => ({
              ...prev,
              balance: balanceInUnit,
            }));
          }
        ) as unknown as () => void;
        unsubscribe = unsub;
      } catch (error) {
        console.error("Failed to subscribe to balance:", error);
      }
    };

    subscribeBalance();

    return () => {
      unsubscribe?.();
    };
  }, [api, walletState.address]);

  // Handle account switching - clear React state only, NOT localStorage
  useEffect(() => {
    const currentAddress = walletState.address;
    const previousAddress = previousAddressRef.current;
    
    if (previousAddress && currentAddress && previousAddress !== currentAddress) {
      // Account switched - clear React state ONLY (not localStorage)
      console.log(`Account switched from ${truncateKey(previousAddress)} to ${truncateKey(currentAddress)}`);
      
      // Mark that we're switching accounts - this prevents the save effect from overwriting messages
      isAccountSwitchingRef.current = true;
      
      // Clear React state ONLY - do NOT clear localStorage
      // Message history for each user is preserved in localStorage with key messageHistory_{address}
      setContacts([]);
      setMessages([]); // Clear state - will be reloaded from new user's localStorage by the load effect
      setUserProfile(null);
      
      toast({
        title: "Account switched",
        description: `Switched to ${truncateKey(currentAddress)}`,
      });
    }
    
    previousAddressRef.current = currentAddress;
  }, [walletState.address]);

  // Poll for account changes from Polkadot extension
  useEffect(() => {
    if (!walletState.connected) return;
    
    const checkAccountChange = setInterval(async () => {
      try {
        const currentAccounts = await web3Accounts();
        if (currentAccounts.length > 0) {
          const newAddress = currentAccounts[0].address;
          if (newAddress && newAddress !== walletState.address) {
            setWalletState((prev) => ({
              ...prev,
              address: newAddress,
              balance: null,
              accounts: currentAccounts.map((a) => ({
                address: a.address,
                meta: { name: a.meta.name },
              })),
            }));
          }
        }
      } catch (error) {
        console.error("Failed to check account changes:", error);
      }
    }, 2000);
    
    return () => clearInterval(checkAccountChange);
  }, [walletState.connected, walletState.address]);

  const connectWallet = useCallback(async () => {
    try {
      const extensions = await web3Enable(APP_NAME);
      
      if (extensions.length === 0) {
        toast({
          title: "No wallet found",
          description: "Please install Polkadot.js extension",
          variant: "destructive",
        });
        return;
      }

      const allAccounts = await web3Accounts();
      
      if (allAccounts.length === 0) {
        toast({
          title: "No accounts found",
          description: "Please create an account in your wallet",
          variant: "destructive",
        });
        return;
      }

      setWalletState({
        connected: true,
        address: allAccounts[0].address,
        balance: null,
        accounts: allAccounts.map((a) => ({
          address: a.address,
          meta: { name: a.meta.name },
        })),
      });

      toast({
        title: "Wallet connected",
        description: `Connected as ${allAccounts[0].meta.name || allAccounts[0].address.slice(0, 8)}...`,
      });
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      toast({
        title: "Connection failed",
        description: error instanceof Error ? error.message : "Failed to connect wallet",
        variant: "destructive",
      });
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    setWalletState({
      connected: false,
      address: null,
      balance: null,
      accounts: [],
    });
    setUserProfile(null);
    setContacts([]);
    setMessages([]);
    previousAddressRef.current = null;
  }, []);

  const selectAccount = useCallback((address: string) => {
    // This will trigger the account switch effect which clears state
    setWalletState((prev) => ({
      ...prev,
      address,
      balance: null,
    }));
  }, []);

  const fetchUserProfile = useCallback(async (address: string): Promise<UserProfile | null> => {
    if (!api) return null;

    try {
      const profile = await api.query.messaging?.userProfiles?.(address);
      
      if (profile && !profile.isEmpty) {
        const publicKeyData = profile.toHuman();
        return {
          address,
          publicKey: typeof publicKeyData === "string" ? publicKeyData : JSON.stringify(publicKeyData),
          bondPaid: true,
        };
      }
      return null;
    } catch (error) {
      console.error("Failed to fetch user profile:", error);
      return null;
    }
  }, [api]);

  const registerProfile = useCallback(async (publicKey: Uint8Array) => {
    if (!api || !walletState.address) {
      throw new Error("API or wallet not connected");
    }

    try {
      const injector = await web3FromAddress(walletState.address);
      
      const tx = api.tx.messaging?.registerProfile?.(Array.from(publicKey));
      
      if (!tx) {
        throw new Error("Messaging pallet not found");
      }

      await new Promise<void>((resolve, reject) => {
        tx.signAndSend(
          walletState.address!,
          { signer: injector.signer },
          ({ status, dispatchError }) => {
            if (status.isInBlock) {
              toast({
                title: "Transaction included",
                description: `Included in block ${status.asInBlock.toHex()}`,
              });
            } else if (status.isFinalized) {
              if (dispatchError) {
                if (dispatchError.isModule) {
                  const decoded = api.registry.findMetaError(dispatchError.asModule);
                  reject(new Error(`${decoded.section}.${decoded.name}`));
                } else {
                  reject(new Error(dispatchError.toString()));
                }
              } else {
                setUserProfile({
                  address: walletState.address!,
                  publicKey: Array.from(publicKey).map((b) => b.toString(16).padStart(2, "0")).join(""),
                  bondPaid: true,
                });
                resolve();
              }
            }
          }
        ).catch(reject);
      });

      toast({
        title: "Profile registered!",
        description: `Spam bond of ${SPAM_BOND / BigInt(10 ** 12)} UNIT deducted`,
      });
    } catch (error) {
      console.error("Failed to register profile:", error);
      throw error;
    }
  }, [api, walletState.address]);

  const updateProfile = useCallback(async (publicKey: Uint8Array): Promise<string> => {
    if (!api || !walletState.address) {
      throw new Error("API or wallet not connected");
    }

    try {
      const injector = await web3FromAddress(walletState.address);
      
      const tx = api.tx.messaging?.updateProfile?.(Array.from(publicKey));
      
      if (!tx) {
        throw new Error("Messaging pallet not found");
      }

      const txHash = await new Promise<string>((resolve, reject) => {
        tx.signAndSend(
          walletState.address!,
          { signer: injector.signer },
          ({ status, dispatchError }) => {
            if (status.isInBlock) {
              toast({
                title: "Transaction included",
                description: `Included in block ${status.asInBlock.toHex()}`,
              });
            } else if (status.isFinalized) {
              if (dispatchError) {
                if (dispatchError.isModule) {
                  const decoded = api.registry.findMetaError(dispatchError.asModule);
                  reject(new Error(`${decoded.section}.${decoded.name}`));
                } else {
                  reject(new Error(dispatchError.toString()));
                }
              } else {
                setUserProfile({
                  address: walletState.address!,
                  publicKey: Array.from(publicKey).map((b) => b.toString(16).padStart(2, "0")).join(""),
                  bondPaid: true,
                });
                resolve(status.asFinalized.toHex());
              }
            }
          }
        ).catch(reject);
      });

      return txHash;
    } catch (error) {
      console.error("Failed to update profile:", error);
      throw error;
    }
  }, [api, walletState.address]);

  const isContactApproved = useCallback(async (contactAddress: string): Promise<boolean> => {
    if (!api || !walletState.address) return false;

    try {
      const approved = await api.query.messaging?.approvedContacts?.(
        walletState.address,
        contactAddress
      );
      return approved?.toHuman() === true;
    } catch (error) {
      console.error("Failed to check contact approval:", error);
      return false;
    }
  }, [api, walletState.address]);

  // Fetch contacts ONLY from blockchain - no localStorage
  const fetchContacts = useCallback(async () => {
    if (!api || !walletState.address) {
      setContacts([]);
      return;
    }

    setContactsLoading(true);
    
    try {
      // Query all approved contacts entries for current user from blockchain
      const entries = await api.query.messaging?.approvedContacts?.entries(walletState.address);
      
      if (!entries || entries.length === 0) {
        setContacts([]);
        setContactsLoading(false);
        return;
      }

      const fetchedContacts: Contact[] = [];

      for (const [key, value] of entries) {
        // value.isTrue indicates approval
        if (value && value.toHuman() === true) {
          // Extract contact address from storage key
          // key.args[1] is the contact address
          const contactAddress = key.args[1].toString();
          
          // Check if they approved us back
          const theirApproval = await api.query.messaging?.approvedContacts?.(
            contactAddress,
            walletState.address
          );
          
          const approvedByThem = theirApproval?.toHuman() === true;
          
          fetchedContacts.push({
            address: contactAddress,
            status: approvedByThem ? "active" : "pending",
            addedAt: Date.now(),
            approvedByMe: true,
            approvedByThem,
          });
        }
      }

      setContacts(fetchedContacts);
    } catch (error) {
      console.error("Failed to fetch contacts from blockchain:", error);
      toast({
        title: "Failed to fetch contacts",
        description: "Could not load contacts from blockchain. Please try again.",
        variant: "destructive",
      });
      setContacts([]);
    } finally {
      setContactsLoading(false);
    }
  }, [api, walletState.address]);

  // Manual refresh function
  const refreshContacts = useCallback(async () => {
    await fetchContacts();
    toast({
      title: "Contacts refreshed",
      description: "Contact list synced with blockchain",
    });
  }, [fetchContacts]);

  const approveContact = useCallback(async (contactAddress: string) => {
    if (!api || !walletState.address) {
      throw new Error("API or wallet not connected");
    }

    try {
      const injector = await web3FromAddress(walletState.address);
      const tx = api.tx.messaging?.approveContact?.(contactAddress);
      
      if (!tx) {
        throw new Error("Messaging pallet not found");
      }

      await new Promise<void>((resolve, reject) => {
        tx.signAndSend(
          walletState.address!,
          { signer: injector.signer },
          ({ status, dispatchError }) => {
            if (status.isFinalized) {
              if (dispatchError) {
                if (dispatchError.isModule) {
                  const decoded = api.registry.findMetaError(dispatchError.asModule);
                  reject(new Error(`${decoded.section}.${decoded.name}`));
                } else {
                  reject(new Error(dispatchError.toString()));
                }
              } else {
                resolve();
              }
            }
          }
        ).catch(reject);
      });

      toast({
        title: "Contact approved",
        description: "Contact has been approved on blockchain",
      });
    } catch (error) {
      console.error("Failed to approve contact:", error);
      throw error;
    }
  }, [api, walletState.address]);

  const addContact = useCallback(async (address: string) => {
    // First approve on blockchain
    await approveContact(address);
    // Then re-fetch contacts from blockchain to update UI
    await fetchContacts();
  }, [approveContact, fetchContacts]);

  const removeContact = useCallback(async (contactAddress: string) => {
    if (!api || !walletState.address) {
      throw new Error("API or wallet not connected");
    }

    try {
      const injector = await web3FromAddress(walletState.address);
      const tx = api.tx.messaging?.removeContact?.(contactAddress);
      
      if (!tx) {
        throw new Error("Messaging pallet not found");
      }

      await new Promise<void>((resolve, reject) => {
        tx.signAndSend(
          walletState.address!,
          { signer: injector.signer },
          ({ status, dispatchError }) => {
            if (status.isFinalized) {
              if (dispatchError) {
                if (dispatchError.isModule) {
                  const decoded = api.registry.findMetaError(dispatchError.asModule);
                  reject(new Error(`${decoded.section}.${decoded.name}`));
                } else {
                  reject(new Error(dispatchError.toString()));
                }
              } else {
                resolve();
              }
            }
          }
        ).catch(reject);
      });

      // Re-fetch contacts from blockchain after removal
      await fetchContacts();

      toast({
        title: "Contact removed",
        description: "Contact has been removed from blockchain",
      });
    } catch (error) {
      console.error("Failed to remove contact:", error);
      throw error;
    }
  }, [api, walletState.address, fetchContacts]);

  const sendMessageHash = useCallback(async (recipient: string, hash: string): Promise<{ messageId: string; blockNumber: number }> => {
    if (!api || !walletState.address) {
      throw new Error("API or wallet not connected");
    }

    try {
      const injector = await web3FromAddress(walletState.address);
      const tx = api.tx.messaging?.sendMessageHash?.(recipient, hash);
      
      if (!tx) {
        throw new Error("Messaging pallet not found");
      }

      const result = await new Promise<{ messageId: string; blockNumber: number }>((resolve, reject) => {
        tx.signAndSend(
          walletState.address!,
          { signer: injector.signer },
          async ({ status, dispatchError, events }) => {
            if (status.isFinalized) {
              if (dispatchError) {
                if (dispatchError.isModule) {
                  const decoded = api.registry.findMetaError(dispatchError.asModule);
                  reject(new Error(`${decoded.section}.${decoded.name}`));
                } else {
                  reject(new Error(dispatchError.toString()));
                }
              } else {
                // Try to find message ID from events
                const messageEvent = events.find((e) => 
                  e.event.section === "messaging" && e.event.method === "MessageHashSent"
                );
                const msgId = messageEvent?.event.data?.[0]?.toString() || `msg_${Date.now()}`;
                
                // Get block number
                const blockHash = status.asFinalized;
                const block = await api.rpc.chain.getBlock(blockHash);
                const blockNum = block.block.header.number.toNumber();
                
                resolve({ messageId: msgId, blockNumber: blockNum });
              }
            }
          }
        ).catch(reject);
      });

      return result;
    } catch (error) {
      console.error("Failed to send message hash:", error);
      throw error;
    }
  }, [api, walletState.address]);

  const fetchMessageHashes = useCallback(async () => {
    // Verification of stored messages against blockchain
    if (!api || messages.length === 0) return;

    const updatedMessages = await Promise.all(
      messages.map(async (msg) => {
        if (msg.status !== "verified" && msg.id) {
          try {
            const stored = await api.query.messaging?.messageHashes?.(msg.id);
            if (stored && !stored.isEmpty) {
              return { ...msg, status: "verified" as const };
            }
          } catch (e) {
            console.error("Failed to verify message:", e);
          }
        }
        return msg;
      })
    );

    setMessages(updatedMessages);
  }, [api, messages]);

  const addStoredMessage = useCallback((message: StoredMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const updateMessageStatus = useCallback((
    id: string, 
    status: StoredMessage["status"], 
    blockNumber?: number,
    newId?: string,
    updates?: Partial<StoredMessage>
  ) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          return { 
            ...m, 
            ...(updates || {}),
            id: newId ?? m.id,
            status, 
            blockNumber: blockNumber ?? m.blockNumber,
          };
        }
        return m;
      })
    );
  }, []);

  // Verify a message hash against blockchain
  const verifyMessageOnChain = useCallback(async (
    messageId: string, 
    localHash: string
  ): Promise<MessageVerificationResult> => {
    if (!api) {
      return { verified: false, expired: false, error: "API not connected" };
    }

    try {
      const currentBlock = blockchainState.blockNumber;
      
      // Query message hash from blockchain
      const storedData = await api.query.messaging?.messageHashes?.(messageId);
      
      if (!storedData || storedData.isEmpty) {
        return { verified: false, expired: false, error: "Message not found on blockchain" };
      }

      // Parse stored data - format: (Hash, BlockNumber, Sender, Recipient)
      const data = storedData.toHuman() as [string, string, string, string] | null;
      
      if (!data) {
        return { verified: false, expired: false, error: "Invalid blockchain data" };
      }

      const [blockchainHash, blockNumStr] = data;
      const blockNumber = parseInt(blockNumStr.replace(/,/g, ""), 10);
      
      // Check expiry
      const expiryBlock = blockNumber + MESSAGE_HASH_EXPIRY_BLOCKS;
      const blocksRemaining = expiryBlock - currentBlock;
      const daysRemaining = Math.floor(blocksRemaining / BLOCKS_PER_DAY);
      
      if (blocksRemaining <= 0) {
        return { 
          verified: false, 
          expired: true, 
          blockchainHash,
          computedHash: localHash,
          blockNumber,
          blocksRemaining: 0,
          daysRemaining: 0,
        };
      }

      // Compare hashes
      const verified = blockchainHash.toLowerCase() === localHash.toLowerCase() ||
                       blockchainHash === localHash ||
                       blockchainHash === `0x${localHash}` ||
                       `0x${blockchainHash}` === localHash;

      return {
        verified,
        expired: false,
        blockchainHash,
        computedHash: localHash,
        blockNumber,
        blocksRemaining,
        daysRemaining,
      };
    } catch (error) {
      console.error("Failed to verify message on chain:", error);
      return { 
        verified: false, 
        expired: false, 
        error: error instanceof Error ? error.message : "Verification failed" 
      };
    }
  }, [api, blockchainState.blockNumber]);

  // Fetch user profile and contacts when wallet connects or account changes
  useEffect(() => {
    if (walletState.address && api) {
      fetchUserProfile(walletState.address).then(setUserProfile);
      fetchContacts();
    }
  }, [walletState.address, api, fetchUserProfile, fetchContacts]);

  const value: BlockchainContextType = {
    api,
    blockchainState,
    walletState,
    userProfile,
    contacts,
    messages,
    contactsLoading,
    connectWallet,
    disconnectWallet,
    selectAccount,
    registerProfile,
    updateProfile,
    fetchUserProfile,
    addContact,
    approveContact,
    removeContact,
    fetchContacts,
    refreshContacts,
    isContactApproved,
    sendMessageHash,
    fetchMessageHashes,
    addStoredMessage,
    updateMessageStatus,
    verifyMessageOnChain,
  };

  return (
    <BlockchainContext.Provider value={value}>
      {children}
    </BlockchainContext.Provider>
  );
}

export function useBlockchain() {
  const context = useContext(BlockchainContext);
  if (!context) {
    throw new Error("useBlockchain must be used within BlockchainProvider");
  }
  return context;
}
