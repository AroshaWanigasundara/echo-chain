import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Key, Eye, EyeOff, Copy, Check, Download, AlertTriangle, 
  X, Shield, RefreshCw 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { useEncryption } from "@/contexts/EncryptionContext";
import { toast } from "@/hooks/use-toast";

interface KeyManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "view" | "generate" | "confirm-replace";
  onConfirmReplace?: () => void;
}

export function KeyManagementModal({ 
  isOpen, 
  onClose, 
  mode, 
  onConfirmReplace 
}: KeyManagementModalProps) {
  const { publicKey, exportPrivateKey } = useEncryption();
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [copiedPublic, setCopiedPublic] = useState(false);
  const [copiedPrivate, setCopiedPrivate] = useState(false);

  const privateKey = exportPrivateKey();

  const copyKey = async (key: string, type: "public" | "private") => {
    await navigator.clipboard.writeText(key);
    if (type === "public") {
      setCopiedPublic(true);
      setTimeout(() => setCopiedPublic(false), 2000);
    } else {
      setCopiedPrivate(true);
      setTimeout(() => setCopiedPrivate(false), 2000);
    }
    toast({
      title: "Copied!",
      description: `${type === "public" ? "Public" : "Private"} key copied to clipboard`,
    });
  };

  const handleExport = () => {
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

  if (mode === "confirm-replace") {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="glass border-warning/30 w-[calc(100%-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-warning text-base sm:text-lg">
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" />
              Replace Existing Keys?
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-destructive mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-destructive">
                    Warning: Key Replacement Risks
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Your old messages may become inaccessible</li>
                    <li>• Others must fetch your new public key to message you</li>
                    <li>• Old keys cannot decrypt new messages</li>
                    <li>• New keys cannot decrypt old messages</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1 text-sm"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  onConfirmReplace?.();
                  onClose();
                }}
                className="flex-1 bg-warning hover:bg-warning/90 text-warning-foreground text-sm"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Replace Keys
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (mode === "view") {
    const hasKeys = publicKey && privateKey;

    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="glass border-border/50 w-[calc(100%-2rem)] max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Key className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              Your Encryption Keys
            </DialogTitle>
            <DialogDescription className="text-sm">
              {hasKeys 
                ? "View and manage your encryption keys securely"
                : "No keys found in storage"}
            </DialogDescription>
          </DialogHeader>
          
          {!hasKeys ? (
            <div className="py-8 text-center space-y-4">
              <div className="h-16 w-16 mx-auto rounded-full bg-muted/50 flex items-center justify-center">
                <Key className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">No keys found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Please generate new keys first to enable encryption.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Security Warning */}
              <div className="p-3 rounded-lg bg-warning/10 border border-warning/30">
                <div className="flex items-center gap-2 text-warning">
                  <Eye className="h-4 w-4" />
                  <span className="text-xs font-medium">
                    Make sure no one is watching your screen
                  </span>
                </div>
              </div>

              {/* Public Key */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Public Key</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 gap-1"
                    onClick={() => copyKey(publicKey, "public")}
                  >
                    {copiedPublic ? (
                      <Check className="h-3 w-3 text-success" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    <span className="text-xs">Copy</span>
                  </Button>
                </div>
                <code className="block p-3 rounded-md bg-secondary/50 font-mono text-xs break-all">
                  0x{publicKey}
                </code>
              </div>

              {/* Private Key */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-destructive">
                    Private Key
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 gap-1"
                      onClick={() => setShowPrivateKey(!showPrivateKey)}
                    >
                      {showPrivateKey ? (
                        <EyeOff className="h-3 w-3" />
                      ) : (
                        <Eye className="h-3 w-3" />
                      )}
                      <span className="text-xs">
                        {showPrivateKey ? "Hide" : "Reveal"}
                      </span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 gap-1"
                      onClick={() => copyKey(privateKey, "private")}
                      disabled={!showPrivateKey}
                    >
                      {copiedPrivate ? (
                        <Check className="h-3 w-3 text-success" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      <span className="text-xs">Copy</span>
                    </Button>
                  </div>
                </div>
                <div className="relative">
                  <code className={`block p-3 rounded-md bg-destructive/10 border border-destructive/30 font-mono text-xs break-all transition-all duration-300 ${!showPrivateKey ? "blur-lg select-none" : ""}`}>
                    0x{privateKey}
                  </code>
                  {!showPrivateKey && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowPrivateKey(true)}
                        className="gap-2 border-destructive/30"
                      >
                        <Eye className="h-4 w-4" />
                        Click to reveal
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-3 w-3" />
                  <span className="text-xs font-medium">
                    🔴 NEVER share or expose this key!
                  </span>
                </div>
              </div>

              {/* Export Button */}
              <Button
                variant="outline"
                onClick={handleExport}
                className="w-full gap-2"
              >
                <Download className="h-4 w-4" />
                Export Keys as JSON
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return null;
}
