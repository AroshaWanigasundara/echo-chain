import { motion, AnimatePresence } from "framer-motion";
import { 
  Key, Shield, Copy, Check, AlertTriangle, Loader2, Download, 
  Eye, RefreshCw, Coins, Wallet 
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useBlockchain } from "@/contexts/BlockchainContext";
import { useEncryption } from "@/contexts/EncryptionContext";
import { truncateKey, hexToKey } from "@/lib/encryption";
import { SPAM_BOND } from "@/lib/constants";
import { KeyManagementModal } from "./KeyManagementModal";
import { UpdateProfileModal } from "./UpdateProfileModal";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function ProfileCard() {
  const { walletState, userProfile, registerProfile, blockchainState } = useBlockchain();
  const { publicKey, hasKeys, isGenerating, generateKeys, exportPrivateKey } = useEncryption();
  
  const [copied, setCopied] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyModalMode, setKeyModalMode] = useState<"view" | "generate" | "confirm-replace">("view");
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showRegisterConfirm, setShowRegisterConfirm] = useState(false);
  const [showKeyWarning, setShowKeyWarning] = useState(false);
  const [expandedKey, setExpandedKey] = useState(false);

  const copyPublicKey = async () => {
    if (publicKey) {
      await navigator.clipboard.writeText(`0x${publicKey}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied!",
        description: "Public key copied to clipboard",
      });
    }
  };

  const handleGenerateKeys = async () => {
    if (hasKeys) {
      setKeyModalMode("confirm-replace");
      setShowKeyModal(true);
    } else {
      await performKeyGeneration();
    }
  };

  const performKeyGeneration = async () => {
    await generateKeys();
    setShowKeyWarning(true);
    toast({
      title: "🔐 Keys generated successfully!",
      description: "Your private key is the ONLY way to decrypt messages. Save it securely!",
    });
  };

  const handleViewKeys = () => {
    setKeyModalMode("view");
    setShowKeyModal(true);
  };

  const handleRegisterClick = () => {
    if (!publicKey) {
      toast({
        title: "Generate keys first",
        description: "You need to generate encryption keys before registering",
        variant: "destructive",
      });
      return;
    }
    setShowRegisterConfirm(true);
  };

  const handleRegister = async () => {
    if (!publicKey) return;
    
    setIsRegistering(true);
    setShowRegisterConfirm(false);
    
    try {
      const publicKeyBytes = hexToKey(publicKey);
      await registerProfile(publicKeyBytes);
    } catch (error) {
      console.error("Registration failed:", error);
      toast({
        title: "Registration failed",
        description: error instanceof Error ? error.message : "Transaction failed",
        variant: "destructive",
      });
    } finally {
      setIsRegistering(false);
    }
  };

  const handleExportKeys = () => {
    const privateKey = exportPrivateKey();
    if (privateKey && publicKey) {
      const backup = JSON.stringify({
        publicKey: `0x${publicKey}`,
        privateKey: `0x${privateKey}`,
        exportedAt: new Date().toISOString(),
        warning: "NEVER share your private key with anyone!",
      }, null, 2);
      
      const blob = new Blob([backup], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `secure-messenger-keys-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast({
        title: "Keys exported",
        description: "Your keys have been downloaded securely",
      });
    }
  };

  if (!walletState.connected) {
    return (
      <Card className="glass border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Profile
          </CardTitle>
          <CardDescription>Connect your wallet to get started</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Connect your Polkadot.js wallet to register and start messaging securely.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="glass border-border/50 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
          
          <CardHeader className="relative p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                Profile
              </CardTitle>
              <Badge 
                variant="outline" 
                className={`text-[10px] sm:text-xs ${userProfile?.bondPaid 
                  ? "border-success/50 text-success" 
                  : "border-muted-foreground/50 text-muted-foreground"
                }`}
              >
                {userProfile?.bondPaid ? (
                  <>
                    <Check className="h-3 w-3 mr-1" />
                    Registered
                  </>
                ) : (
                  "Not Registered"
                )}
              </Badge>
            </div>
            <CardDescription className="text-xs sm:text-sm">
              {userProfile?.bondPaid 
                ? "Your profile is registered on-chain" 
                : "Register to start secure messaging"}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="relative space-y-4 sm:space-y-6 p-4 sm:p-6 pt-0 sm:pt-0">
            {/* Connection Info */}
            <div className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-secondary/30">
              <div className="flex items-center gap-2">
                <Wallet className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                <span className="text-[10px] sm:text-xs text-muted-foreground">
                  {truncateKey(walletState.address || "")}
                </span>
              </div>
              {walletState.balance && (
                <div className="flex items-center gap-1">
                  <Coins className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                  <span className="text-xs sm:text-sm font-mono font-medium">
                    {walletState.balance} UNIT
                  </span>
                </div>
              )}
            </div>

            {/* Key Management Section */}
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs sm:text-sm font-medium flex items-center gap-2">
                  <Key className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                  Encryption Keys
                </h3>
                {hasKeys && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 sm:h-7 px-2 gap-1"
                    onClick={handleExportKeys}
                  >
                    <Download className="h-3 w-3" />
                    <span className="text-[10px] sm:text-xs">Export</span>
                  </Button>
                )}
              </div>

              {/* Key Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={handleGenerateKeys}
                  disabled={isGenerating}
                  className="flex-1 gap-2 text-xs sm:text-sm h-9 sm:h-10"
                  variant={hasKeys ? "outline" : "default"}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Key className="h-4 w-4" />
                      {hasKeys ? "Replace Keys" : "Generate Keys"}
                    </>
                  )}
                </Button>
                
                <Button
                  variant="secondary"
                  onClick={handleViewKeys}
                  disabled={!hasKeys}
                  className="flex-1 gap-2 text-xs sm:text-sm h-9 sm:h-10"
                >
                  <Eye className="h-4 w-4" />
                  View Keys
                </Button>
              </div>

              {/* Key Display */}
              {hasKeys && publicKey && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Public Key</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2"
                      onClick={copyPublicKey}
                    >
                      {copied ? (
                        <Check className="h-3 w-3 text-success" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                  <button
                    onClick={() => setExpandedKey(!expandedKey)}
                    className="w-full text-left"
                  >
                    <code className="block p-2 rounded-md bg-secondary/50 font-mono text-xs break-all hover:bg-secondary/70 transition-colors cursor-pointer">
                      {expandedKey ? `0x${publicKey}` : `0x${truncateKey(publicKey)}`}
                    </code>
                  </button>
                  <p className="text-[10px] text-muted-foreground text-center">
                    {expandedKey ? "Click to collapse" : "Click to expand full key"}
                  </p>
                </motion.div>
              )}

              {/* Key Generation Warning */}
              <AnimatePresence>
                {showKeyWarning && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-3 rounded-md bg-warning/10 border border-warning/30"
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-warning">
                          🔐 Private Key Security
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Your private key is the ONLY way to decrypt messages. 
                          Save it securely! Click "View Keys" to see and export your keys.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-warning/30 hover:bg-warning/10"
                          onClick={() => setShowKeyWarning(false)}
                        >
                          I understand
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Registration/Update Section */}
            <div className="pt-4 border-t border-border/50 space-y-3">
              {!userProfile?.bondPaid ? (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Registration Bond</span>
                    <span className="font-mono text-primary flex items-center gap-1">
                      <Coins className="h-3 w-3" />
                      {(SPAM_BOND / BigInt(10 ** 12)).toString()} UNIT
                    </span>
                  </div>
                  
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="w-full">
                          <Button
                            onClick={handleRegisterClick}
                            disabled={isRegistering || !blockchainState.connected || !hasKeys}
                            className="w-full gap-2"
                          >
                            {isRegistering ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Registering...
                              </>
                            ) : (
                              <>
                                <Shield className="h-4 w-4" />
                                Register Profile
                              </>
                            )}
                          </Button>
                        </div>
                      </TooltipTrigger>
                      {!hasKeys && (
                        <TooltipContent>
                          <p>Generate encryption keys first</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                  
                  <p className="text-xs text-muted-foreground text-center">
                    💰 A spam bond is required to prevent abuse
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-success mb-3">
                    <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                    <span className="text-sm">Profile active on-chain</span>
                  </div>
                  
                  <Button
                    variant="outline"
                    onClick={() => setShowUpdateModal(true)}
                    className="w-full gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Update Public Key
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Key Management Modal */}
      <KeyManagementModal
        isOpen={showKeyModal}
        onClose={() => setShowKeyModal(false)}
        mode={keyModalMode}
        onConfirmReplace={performKeyGeneration}
      />

      {/* Update Profile Modal */}
      <UpdateProfileModal
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
      />

      {/* Registration Confirmation Dialog */}
      <AlertDialog open={showRegisterConfirm} onOpenChange={setShowRegisterConfirm}>
        <AlertDialogContent className="glass border-border/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Confirm Registration
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                This will register your public key on the blockchain and reserve{" "}
                <span className="font-mono text-primary font-medium">
                  {(SPAM_BOND / BigInt(10 ** 12)).toString()} UNIT
                </span>{" "}
                as a spam prevention bond.
              </p>
              <div className="p-3 rounded-lg bg-warning/10 border border-warning/30">
                <div className="flex items-center gap-2 text-warning">
                  <Coins className="h-4 w-4" />
                  <span className="text-xs font-medium">
                    💰 This will lock 10 UNIT as spam prevention bond
                  </span>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRegister}>
              Register Profile
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
