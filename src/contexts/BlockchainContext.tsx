import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { web3Enable, web3Accounts, web3FromAddress } from "@polkadot/extension-dapp";
import { RPC_ENDPOINT, APP_NAME, SPAM_BOND } from "@/lib/constants";
import { BlockchainState, WalletState, UserProfile, Contact, StoredMessage } from "@/lib/types";
import { toast } from "@/hooks/use-toast";

interface BlockchainContextType {
  api: ApiPromise | null;
  blockchainState: BlockchainState;
  walletState: WalletState;
  userProfile: UserProfile | null;
  contacts: Contact[];
  messages: StoredMessage[];
  
  // Wallet functions
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  selectAccount: (address: string) => void;
  
  // Profile functions
  registerProfile: (publicKey: Uint8Array) => Promise<void>;
  fetchUserProfile: (address: string) => Promise<UserProfile | null>;
  
  // Contact functions
  addContact: (address: string) => Promise<void>;
  approveContact: (address: string) => Promise<void>;
  removeContact: (address: string) => Promise<void>;
  fetchContacts: () => Promise<void>;
  isContactApproved: (address: string) => Promise<boolean>;
  
  // Message functions
  sendMessageHash: (recipient: string, hash: string) => Promise<string>;
  fetchMessageHashes: () => Promise<void>;
  addStoredMessage: (message: StoredMessage) => void;
  updateMessageStatus: (id: string, status: StoredMessage["status"], blockNumber?: number) => void;
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

  // Load messages from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("messaging_messages");
    if (stored) {
      try {
        setMessages(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse stored messages:", e);
      }
    }
  }, []);

  // Save messages to localStorage
  useEffect(() => {
    localStorage.setItem("messaging_messages", JSON.stringify(messages));
  }, [messages]);

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
  }, []);

  const selectAccount = useCallback((address: string) => {
    setWalletState((prev) => ({
      ...prev,
      address,
      balance: null,
    }));
    setUserProfile(null);
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
        description: "Contact has been approved successfully",
      });
    } catch (error) {
      console.error("Failed to approve contact:", error);
      throw error;
    }
  }, [api, walletState.address]);

  const addContact = useCallback(async (address: string) => {
    await approveContact(address);
    
    setContacts((prev) => {
      const existing = prev.find((c) => c.address === address);
      if (existing) {
        return prev.map((c) =>
          c.address === address ? { ...c, approvedByMe: true } : c
        );
      }
      return [
        ...prev,
        {
          address,
          status: "pending",
          addedAt: Date.now(),
          approvedByMe: true,
          approvedByThem: false,
        },
      ];
    });
  }, [approveContact]);

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

      setContacts((prev) => prev.filter((c) => c.address !== contactAddress));

      toast({
        title: "Contact removed",
        description: "Contact has been removed successfully",
      });
    } catch (error) {
      console.error("Failed to remove contact:", error);
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

  const fetchContacts = useCallback(async () => {
    // For MVP, contacts are stored locally
    const stored = localStorage.getItem("messaging_contacts");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Check on-chain approval status for each contact
        const updatedContacts = await Promise.all(
          parsed.map(async (contact: Contact) => {
            if (api && walletState.address) {
              const myApproval = await isContactApproved(contact.address);
              // Check if they approved me
              const theirApproval = await api.query.messaging?.approvedContacts?.(
                contact.address,
                walletState.address
              );
              return {
                ...contact,
                approvedByMe: myApproval,
                approvedByThem: theirApproval?.toHuman() === true,
                status: myApproval && theirApproval?.toHuman() === true ? "active" : "pending",
              };
            }
            return contact;
          })
        );
        setContacts(updatedContacts);
      } catch (e) {
        console.error("Failed to parse stored contacts:", e);
      }
    }
  }, [api, walletState.address, isContactApproved]);

  // Save contacts to localStorage
  useEffect(() => {
    if (contacts.length > 0) {
      localStorage.setItem("messaging_contacts", JSON.stringify(contacts));
    }
  }, [contacts]);

  const sendMessageHash = useCallback(async (recipient: string, hash: string): Promise<string> => {
    if (!api || !walletState.address) {
      throw new Error("API or wallet not connected");
    }

    try {
      const injector = await web3FromAddress(walletState.address);
      const tx = api.tx.messaging?.sendMessageHash?.(recipient, hash);
      
      if (!tx) {
        throw new Error("Messaging pallet not found");
      }

      const messageId = await new Promise<string>((resolve, reject) => {
        tx.signAndSend(
          walletState.address!,
          { signer: injector.signer },
          ({ status, dispatchError, events }) => {
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
                resolve(msgId);
              }
            }
          }
        ).catch(reject);
      });

      return messageId;
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

  const updateMessageStatus = useCallback((id: string, status: StoredMessage["status"], blockNumber?: number) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, status, blockNumber: blockNumber ?? m.blockNumber } : m
      )
    );
  }, []);

  // Check user profile when wallet connects
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
    connectWallet,
    disconnectWallet,
    selectAccount,
    registerProfile,
    fetchUserProfile,
    addContact,
    approveContact,
    removeContact,
    fetchContacts,
    isContactApproved,
    sendMessageHash,
    fetchMessageHashes,
    addStoredMessage,
    updateMessageStatus,
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
