import { motion } from "framer-motion";
import { Key, Shield, Copy, Check, AlertTriangle, Loader2, Download } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useBlockchain } from "@/contexts/BlockchainContext";
import { useEncryption } from "@/contexts/EncryptionContext";
import { truncateKey, hexToKey } from "@/lib/encryption";
import { SPAM_BOND } from "@/lib/constants";

export function ProfileCard() {
  const { walletState, userProfile, registerProfile, blockchainState } = useBlockchain();
  const { publicKey, hasKeys, isGenerating, generateKeys, exportPrivateKey } = useEncryption();
  const [copied, setCopied] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);

  const copyPublicKey = async () => {
    if (publicKey) {
      await navigator.clipboard.writeText(publicKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleGenerateKeys = async () => {
    const keys = await generateKeys();
    // Show warning about private key
    setShowPrivateKey(true);
  };

  const handleRegister = async () => {
    if (!publicKey) return;
    
    setIsRegistering(true);
    try {
      const publicKeyBytes = hexToKey(publicKey);
      await registerProfile(publicKeyBytes);
    } catch (error) {
      console.error("Registration failed:", error);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleExportKeys = () => {
    const privateKey = exportPrivateKey();
    if (privateKey && publicKey) {
      const backup = JSON.stringify({
        publicKey,
        privateKey,
        exportedAt: new Date().toISOString(),
      }, null, 2);
      
      const blob = new Blob([backup], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `secure-messenger-keys-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="glass border-border/50 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
        
        <CardHeader className="relative">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Profile
            </CardTitle>
            {userProfile?.bondPaid && (
              <Badge variant="outline" className="border-success/50 text-success">
                <Check className="h-3 w-3 mr-1" />
                Registered
              </Badge>
            )}
          </div>
          <CardDescription>
            {userProfile?.bondPaid 
              ? "Your profile is registered on-chain" 
              : "Register to start secure messaging"}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="relative space-y-4">
          {/* Keys Section */}
          {!hasKeys ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Generate encryption keys to enable end-to-end encrypted messaging.
              </p>
              <Button
                onClick={handleGenerateKeys}
                disabled={isGenerating}
                className="w-full gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Key className="h-4 w-4" />
                    Generate Keys
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Public Key</span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={copyPublicKey}
                  >
                    {copied ? (
                      <Check className="h-3 w-3 text-success" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={handleExportKeys}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <code className="block p-2 rounded-md bg-secondary/50 font-mono text-xs break-all">
                {truncateKey(publicKey || "")}
              </code>

              {showPrivateKey && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="p-3 rounded-md bg-warning/10 border border-warning/30"
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-warning">
                        Important: Backup your private key!
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Your private key is stored locally. If you lose it, you won't be able to decrypt your messages. Click the download button to export a backup.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 border-warning/30 hover:bg-warning/10"
                        onClick={() => setShowPrivateKey(false)}
                      >
                        I understand
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* Registration Section */}
          {hasKeys && !userProfile?.bondPaid && (
            <div className="pt-4 border-t border-border/50 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Registration Bond</span>
                <span className="font-mono text-primary">
                  {(SPAM_BOND / BigInt(10 ** 12)).toString()} UNIT
                </span>
              </div>
              <Button
                onClick={handleRegister}
                disabled={isRegistering || !blockchainState.connected}
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
              <p className="text-xs text-muted-foreground text-center">
                A spam bond is required to prevent abuse
              </p>
            </div>
          )}

          {/* Registered Status */}
          {userProfile?.bondPaid && (
            <div className="pt-4 border-t border-border/50">
              <div className="flex items-center gap-2 text-success">
                <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                <span className="text-sm">Profile active on-chain</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
