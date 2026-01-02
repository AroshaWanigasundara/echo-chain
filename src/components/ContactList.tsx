import { motion, AnimatePresence } from "framer-motion";
import { Users, UserPlus, Check, X, MessageSquare, Loader2, Search, RefreshCw, AlertCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBlockchain } from "@/contexts/BlockchainContext";
import { truncateKey } from "@/lib/encryption";
import { Contact } from "@/lib/types";

interface ContactListProps {
  onSelectContact: (address: string) => void;
  selectedContact: string | null;
}

export function ContactList({ onSelectContact, selectedContact }: ContactListProps) {
  const { 
    walletState, 
    blockchainState,
    contacts, 
    contactsLoading,
    addContact, 
    removeContact,
    refreshContacts 
  } = useBlockchain();
  const [newContactAddress, setNewContactAddress] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [removingContact, setRemovingContact] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleAddContact = async () => {
    if (!newContactAddress.trim()) return;
    
    setIsAdding(true);
    try {
      await addContact(newContactAddress.trim());
      setNewContactAddress("");
    } catch (error) {
      console.error("Failed to add contact:", error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveContact = async (address: string) => {
    setRemovingContact(address);
    try {
      await removeContact(address);
    } catch (error) {
      console.error("Failed to remove contact:", error);
    } finally {
      setRemovingContact(null);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshContacts();
    } finally {
      setIsRefreshing(false);
    }
  };

  const filteredContacts = contacts.filter((contact) =>
    contact.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.nickname?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (contact: Contact) => {
    if (contact.approvedByMe && contact.approvedByThem) {
      return (
        <Badge variant="outline" className="border-success/50 text-success text-xs">
          <Check className="h-3 w-3 mr-1" />
          Active
        </Badge>
      );
    }
    if (contact.approvedByMe) {
      return (
        <Badge variant="outline" className="border-warning/50 text-warning text-xs">
          Pending
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="border-muted-foreground/50 text-muted-foreground text-xs">
        Awaiting
      </Badge>
    );
  };

  if (!walletState.connected) {
    return (
      <Card className="glass border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Contacts
          </CardTitle>
          <CardDescription>Connect wallet to manage contacts</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!blockchainState.connected) {
    return (
      <Card className="glass border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Contacts
          </CardTitle>
          <CardDescription className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            Blockchain not connected
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="h-full flex flex-col"
    >
      <Card className="glass border-border/50 flex-1 flex flex-col overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Contacts
              {contacts.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground">
                  ({contacts.length})
                </span>
              )}
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing || contactsLoading}
              className="h-8 w-8"
              title="Sync with blockchain"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing || contactsLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
          <CardDescription>
            Contacts loaded from blockchain
          </CardDescription>
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col space-y-4 overflow-hidden">
          {/* Add Contact */}
          <div className="flex gap-2">
            <Input
              placeholder="Enter address..."
              value={newContactAddress}
              onChange={(e) => setNewContactAddress(e.target.value)}
              className="font-mono text-sm"
              onKeyDown={(e) => e.key === "Enter" && handleAddContact()}
              disabled={isAdding}
            />
            <Button
              onClick={handleAddContact}
              disabled={isAdding || !newContactAddress.trim()}
              size="icon"
              className="shrink-0"
            >
              {isAdding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Search */}
          {contacts.length > 3 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          )}

          {/* Contact List */}
          <ScrollArea className="flex-1 -mx-4 px-4">
            {contactsLoading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                <p className="text-sm text-muted-foreground">Loading from blockchain...</p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {filteredContacts.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-8 text-muted-foreground"
                  >
                    <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No contacts on blockchain</p>
                    <p className="text-xs mt-1">Add a contact to start messaging</p>
                  </motion.div>
                ) : (
                  <div className="space-y-2">
                    {filteredContacts.map((contact, index) => (
                      <motion.div
                        key={contact.address}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.2, delay: index * 0.05 }}
                        className={`
                          p-3 rounded-lg border transition-all cursor-pointer group
                          ${selectedContact === contact.address 
                            ? "border-primary/50 bg-primary/10" 
                            : "border-border/50 hover:border-primary/30 hover:bg-secondary/50"
                          }
                        `}
                        onClick={() => onSelectContact(contact.address)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-mono text-sm truncate">
                              {contact.nickname || truncateKey(contact.address)}
                            </p>
                            {contact.nickname && (
                              <p className="font-mono text-xs text-muted-foreground truncate">
                                {truncateKey(contact.address)}
                              </p>
                            )}
                          </div>
                          {getStatusBadge(contact)}
                        </div>
                        
                        <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectContact(contact.address);
                            }}
                            disabled={contact.status !== "active"}
                          >
                            <MessageSquare className="h-3 w-3 mr-1" />
                            Message
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveContact(contact.address);
                            }}
                            disabled={removingContact === contact.address}
                          >
                            {removingContact === contact.address ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <X className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </AnimatePresence>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </motion.div>
  );
}
