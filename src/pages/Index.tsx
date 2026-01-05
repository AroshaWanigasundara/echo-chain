import { useState } from "react";
import { motion } from "framer-motion";
import { Header } from "@/components/Header";
import { ProfileCard } from "@/components/ProfileCard";
import { ContactList } from "@/components/ContactList";
import { ChatInterface } from "@/components/ChatInterface";
import { VerificationPanel } from "@/components/VerificationPanel";
import { useBlockchain } from "@/contexts/BlockchainContext";
import { Lock, Shield, Zap, Database } from "lucide-react";

function WelcomeScreen() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4 py-8"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="relative mb-6 sm:mb-8"
      >
        <div className="absolute inset-0 rounded-full bg-primary/20 blur-3xl scale-150" />
        <div className="relative h-16 w-16 sm:h-24 sm:w-24 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center glow">
          <Shield className="h-8 w-8 sm:h-12 sm:w-12 text-primary-foreground" />
        </div>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="text-2xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4"
      >
        <span className="gradient-text">Secure</span> Blockchain Messaging
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="text-sm sm:text-lg text-muted-foreground max-w-md mb-8 sm:mb-12 px-4"
      >
        End-to-end encrypted messages with blockchain verification. 
        Your conversations, your keys, your privacy.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 max-w-3xl w-full px-4"
      >
        <div className="p-4 sm:p-6 rounded-xl glass border-border/50 text-left">
          <Lock className="h-6 w-6 sm:h-8 sm:w-8 text-primary mb-2 sm:mb-3" />
          <h3 className="font-semibold mb-1 text-sm sm:text-base">End-to-End Encryption</h3>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Messages encrypted with NaCl box. Only you and your recipient can read them.
          </p>
        </div>

        <div className="p-4 sm:p-6 rounded-xl glass border-border/50 text-left">
          <Database className="h-6 w-6 sm:h-8 sm:w-8 text-primary mb-2 sm:mb-3" />
          <h3 className="font-semibold mb-1 text-sm sm:text-base">Blockchain Verified</h3>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Message hashes stored on-chain for tamper-proof verification.
          </p>
        </div>

        <div className="p-4 sm:p-6 rounded-xl glass border-border/50 text-left sm:col-span-2 md:col-span-1">
          <Zap className="h-6 w-6 sm:h-8 sm:w-8 text-primary mb-2 sm:mb-3" />
          <h3 className="font-semibold mb-1 text-sm sm:text-base">Decentralized</h3>
          <p className="text-xs sm:text-sm text-muted-foreground">
            No central server. Your data stays with you.
          </p>
        </div>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.5 }}
        className="mt-8 sm:mt-12 text-xs sm:text-sm text-muted-foreground px-4"
      >
        Connect your Polkadot.js wallet to get started →
      </motion.p>
    </motion.div>
  );
}

function Dashboard() {
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);

  const handleSelectContact = (address: string) => {
    setSelectedContact(address);
    setShowChat(true);
  };

  const handleBack = () => {
    setShowChat(false);
  };

  return (
    <div className="container py-4 sm:py-6 px-3 sm:px-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 min-h-[calc(100vh-8rem)]">
        {/* Left Sidebar - Profile & Contacts */}
        <div className={`lg:col-span-3 space-y-4 sm:space-y-6 ${showChat ? "hidden lg:block" : ""}`}>
          <ProfileCard />
          <div className="flex-1 min-h-0">
            <ContactList 
              onSelectContact={handleSelectContact}
              selectedContact={selectedContact}
            />
          </div>
        </div>

        {/* Main Chat Area */}
        <div className={`lg:col-span-6 ${!showChat && !selectedContact ? "hidden lg:block" : ""}`}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-full min-h-[50vh] lg:min-h-0 rounded-xl glass border-border/50 overflow-hidden"
          >
            <ChatInterface 
              contactAddress={selectedContact}
              onBack={handleBack}
            />
          </motion.div>
        </div>

        {/* Right Sidebar - Verification */}
        <div className="lg:col-span-3 hidden lg:block">
          <VerificationPanel />
        </div>
      </div>

      {/* Mobile Verification Panel */}
      <div className="lg:hidden mt-4 sm:mt-6">
        <VerificationPanel />
      </div>

      {/* Production Note */}
      <div className="mt-4 sm:mt-6 p-3 sm:p-4 rounded-lg bg-warning/10 border border-warning/30">
        <p className="text-xs sm:text-sm text-warning">
          <strong>Note:</strong> This is an MVP using localStorage for message storage. 
          In production, replace with IPFS or a backend server for persistent encrypted message storage.
        </p>
      </div>
    </div>
  );
}

export default function Index() {
  const { walletState } = useBlockchain();

  return (
    <div className="min-h-screen bg-background relative">
      {/* Background gradient effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <Header />

      <main className="relative">
        {walletState.connected ? <Dashboard /> : <WelcomeScreen />}
      </main>
    </div>
  );
}
