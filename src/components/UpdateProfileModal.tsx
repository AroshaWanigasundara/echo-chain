import { useState } from "react";
import { motion } from "framer-motion";
import { 
  RefreshCw, Key, AlertTriangle, Loader2, ExternalLink, Check 
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
import { useBlockchain } from "@/contexts/BlockchainContext";
import { hexToKey, truncateKey } from "@/lib/encryption";
import { toast } from "@/hooks/use-toast";

interface UpdateProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UpdateProfileModal({ isOpen, onClose }: UpdateProfileModalProps) {
  const { publicKey, generateKeys, isGenerating } = useEncryption();
  const { updateProfile, userProfile } = useBlockchain();
  const [newPublicKey, setNewPublicKey] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleGenerateNewKeys = async () => {
    const keys = await generateKeys();
    setNewPublicKey(keys.publicKey);
    toast({
      title: "New keys generated",
      description: "Click 'Update Profile' to save them on-chain",
    });
  };

  const handleUpdateProfile = async () => {
    const keyToUpdate = newPublicKey || publicKey;
    if (!keyToUpdate) return;

    setIsUpdating(true);
    try {
      const publicKeyBytes = hexToKey(keyToUpdate);
      const hash = await updateProfile(publicKeyBytes);
      setTxHash(hash);
      toast({
        title: "Profile updated successfully!",
        description: "Your new public key is now on-chain",
      });
    } catch (error) {
      console.error("Failed to update profile:", error);
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Transaction failed",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClose = () => {
    setNewPublicKey(null);
    setTxHash(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="glass border-border/50 max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Update Profile
          </DialogTitle>
          <DialogDescription>
            Update your public key on the blockchain
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {txHash ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-6 text-center space-y-4"
            >
              <div className="h-16 w-16 mx-auto rounded-full bg-success/20 flex items-center justify-center">
                <Check className="h-8 w-8 text-success" />
              </div>
              <div>
                <p className="text-sm font-medium text-success">
                  Profile Updated Successfully!
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Transaction Hash:
                </p>
                <code className="text-xs font-mono text-primary break-all">
                  {truncateKey(txHash)}
                </code>
              </div>
              <Button onClick={handleClose} className="w-full">
                Done
              </Button>
            </motion.div>
          ) : (
            <>
              {/* Current Public Key */}
              <div className="space-y-2">
                <span className="text-sm text-muted-foreground">
                  Current Public Key
                </span>
                <code className="block p-2 rounded-md bg-secondary/50 font-mono text-xs break-all">
                  0x{truncateKey(userProfile?.publicKey || publicKey || "")}
                </code>
              </div>

              {/* New Public Key (if generated) */}
              {newPublicKey && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="space-y-2"
                >
                  <span className="text-sm text-success font-medium">
                    New Public Key
                  </span>
                  <code className="block p-2 rounded-md bg-success/10 border border-success/30 font-mono text-xs break-all">
                    0x{truncateKey(newPublicKey)}
                  </code>
                </motion.div>
              )}

              {/* Warning */}
              <div className="p-3 rounded-lg bg-warning/10 border border-warning/30">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs text-warning font-medium">
                      Important Notice
                    </p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Others must fetch your new key to message you</li>
                      <li>• Old keys cannot decrypt new messages</li>
                      <li>• New keys cannot decrypt old messages</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <Button
                  variant="outline"
                  onClick={handleGenerateNewKeys}
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
                      Generate New Keys
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleUpdateProfile}
                  disabled={isUpdating || (!newPublicKey && !publicKey)}
                  className="w-full gap-2"
                >
                  {isUpdating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      Update Profile
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
