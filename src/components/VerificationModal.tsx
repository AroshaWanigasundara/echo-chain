import { motion, AnimatePresence } from "framer-motion";
import { 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  Clock, 
  Copy, 
  X, 
  RefreshCw,
  Loader2,
  Hash,
  Blocks
} from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChatMessage, MessageVerificationResult } from "@/lib/types";
import { BLOCKS_PER_DAY, BLOCKS_PER_HOUR } from "@/lib/constants";
import { toast } from "@/hooks/use-toast";

interface VerificationModalProps {
  message: ChatMessage | null;
  isOpen: boolean;
  onClose: () => void;
  onVerify: (message: ChatMessage) => Promise<MessageVerificationResult>;
}

export function VerificationModal({ 
  message, 
  isOpen, 
  onClose,
  onVerify 
}: VerificationModalProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<MessageVerificationResult | null>(null);

  const handleVerify = async () => {
    if (!message) return;
    
    setIsVerifying(true);
    try {
      const verificationResult = await onVerify(message);
      setResult(verificationResult);
    } catch (error) {
      setResult({
        verified: false,
        expired: false,
        error: error instanceof Error ? error.message : "Verification failed"
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
  };

  const formatTimeRemaining = (blocksRemaining: number) => {
    if (blocksRemaining <= 0) return "Expired";
    
    const days = Math.floor(blocksRemaining / BLOCKS_PER_DAY);
    const hours = Math.floor((blocksRemaining % BLOCKS_PER_DAY) / BLOCKS_PER_HOUR);
    
    if (days > 0) {
      return `${days} day${days > 1 ? "s" : ""} ${hours} hour${hours !== 1 ? "s" : ""}`;
    }
    return `${hours} hour${hours !== 1 ? "s" : ""}`;
  };

  const getStatusIcon = () => {
    if (isVerifying) {
      return <Loader2 className="h-8 w-8 animate-spin text-primary" />;
    }
    if (!result) {
      return <Shield className="h-8 w-8 text-muted-foreground" />;
    }
    if (result.expired) {
      return <Clock className="h-8 w-8 text-warning" />;
    }
    if (result.verified) {
      return <ShieldCheck className="h-8 w-8 text-success" />;
    }
    return <ShieldAlert className="h-8 w-8 text-destructive" />;
  };

  const getStatusText = () => {
    if (isVerifying) return "Verifying...";
    if (!result) return "Click verify to check";
    if (result.error) return result.error;
    if (result.expired) return "Message Expired";
    if (result.verified) return "Verified ✓";
    return "Hash Mismatch ⚠️";
  };

  const getStatusColor = () => {
    if (!result) return "text-muted-foreground";
    if (result.expired) return "text-warning";
    if (result.verified) return "text-success";
    return "text-destructive";
  };

  // Reset result when modal closes or message changes
  const handleClose = () => {
    setResult(null);
    onClose();
  };

  if (!message) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md glass border-border/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Message Verification
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status Display */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center py-4"
          >
            <div className="p-4 rounded-full bg-background/50 border border-border/50 mb-3">
              {getStatusIcon()}
            </div>
            <p className={`font-semibold ${getStatusColor()}`}>
              {getStatusText()}
            </p>
          </motion.div>

          {/* Message Info */}
          <div className="space-y-3 text-sm">
            {message.blockNumber && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-background/50 border border-border/50">
                <Blocks className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-muted-foreground text-xs">Block Number</p>
                  <p className="font-mono">{message.blockNumber.toLocaleString()}</p>
                </div>
              </div>
            )}

            {result?.blockchainHash && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-background/50 border border-border/50 overflow-hidden">
                <Hash className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0 overflow-hidden">
                  <p className="text-muted-foreground text-xs">Blockchain Hash</p>
                  <p className="font-mono text-xs break-all">{result.blockchainHash}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => copyToClipboard(result.blockchainHash!, "Blockchain hash")}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            )}

            {result?.computedHash && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-background/50 border border-border/50 overflow-hidden">
                <Hash className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0 overflow-hidden">
                  <p className="text-muted-foreground text-xs">Computed Hash</p>
                  <p className="font-mono text-xs break-all">{result.computedHash}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => copyToClipboard(result.computedHash!, "Computed hash")}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            )}

            {/* Hash Match Indicator */}
            {result?.blockchainHash && result?.computedHash && (
              <div className={`p-3 rounded-lg border ${
                result.verified 
                  ? "bg-success/10 border-success/30" 
                  : "bg-destructive/10 border-destructive/30"
              }`}>
                <p className={`text-sm font-medium text-center ${
                  result.verified ? "text-success" : "text-destructive"
                }`}>
                  {result.verified 
                    ? "✓ Hashes Match - Message Authentic" 
                    : "⚠️ Hashes Do Not Match - Message May Be Tampered"}
                </p>
              </div>
            )}

            {/* Expiry Info */}
            {result && result.blocksRemaining !== undefined && (
              <div className={`flex items-center gap-3 p-3 rounded-lg border ${
                result.expired 
                  ? "bg-destructive/10 border-destructive/30" 
                  : result.blocksRemaining < BLOCKS_PER_DAY 
                    ? "bg-warning/10 border-warning/30"
                    : "bg-background/50 border-border/50"
              }`}>
                <Clock className={`h-4 w-4 ${
                  result.expired 
                    ? "text-destructive" 
                    : result.blocksRemaining < BLOCKS_PER_DAY 
                      ? "text-warning" 
                      : "text-muted-foreground"
                }`} />
                <div>
                  <p className="text-muted-foreground text-xs">
                    {result.expired ? "Verification Expired" : "Expires In"}
                  </p>
                  <p className="font-medium">
                    {formatTimeRemaining(result.blocksRemaining)}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleClose}
            >
              <X className="h-4 w-4 mr-2" />
              Close
            </Button>
            <Button
              className="flex-1"
              onClick={handleVerify}
              disabled={isVerifying}
            >
              {isVerifying ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {result ? "Re-verify" : "Verify"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}