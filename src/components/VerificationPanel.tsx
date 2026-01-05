import { motion } from "framer-motion";
import { Shield, CheckCircle, XCircle, Clock, RefreshCw, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBlockchain } from "@/contexts/BlockchainContext";
import { truncateKey } from "@/lib/encryption";
import { formatDistanceToNow } from "date-fns";

export function VerificationPanel() {
  const { messages, fetchMessageHashes, blockchainState } = useBlockchain();
  const [isVerifying, setIsVerifying] = useState(false);

  const handleVerifyAll = async () => {
    setIsVerifying(true);
    try {
      await fetchMessageHashes();
    } finally {
      setIsVerifying(false);
    }
  };

  const recentMessages = messages
    .slice(-20)
    .reverse();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "verified":
        return <CheckCircle className="h-4 w-4 text-success" />;
      case "sending":
        return <Clock className="h-4 w-4 text-warning animate-pulse" />;
      case "sent":
        return <Clock className="h-4 w-4 text-primary" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "verified":
        return "Verified on-chain";
      case "sending":
        return "Sending...";
      case "sent":
        return "Sent, awaiting confirmation";
      case "failed":
        return "Failed";
      default:
        return "Unknown";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      <Card className="glass border-border/50">
        <CardHeader className="pb-2 sm:pb-3 p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                Verification
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">Message hash verification status</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleVerifyAll}
              disabled={isVerifying}
              className="gap-1 sm:gap-2 text-xs sm:text-sm h-8 sm:h-9"
            >
              {isVerifying ? (
                <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4" />
              )}
              Verify
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
          {/* Block Info */}
          <div className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-secondary/30 mb-3 sm:mb-4">
            <span className="text-xs sm:text-sm text-muted-foreground">Current Block</span>
            <span className="font-mono text-primary text-xs sm:text-sm">
              #{blockchainState.blockNumber.toLocaleString()}
            </span>
          </div>

          {/* Message Status List */}
          <ScrollArea className="h-[150px] sm:h-[200px]">
            {recentMessages.length === 0 ? (
              <div className="text-center py-6 sm:py-8 text-muted-foreground">
                <Shield className="h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-2 opacity-30" />
                <p className="text-xs sm:text-sm">No messages to verify</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentMessages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2 sm:gap-3 p-2 rounded-lg hover:bg-secondary/30 transition-colors"
                  >
                    {getStatusIcon(message.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] sm:text-xs font-mono truncate">
                        {truncateKey(message.hash)}
                      </p>
                      <p className="text-[9px] sm:text-[10px] text-muted-foreground">
                        {getStatusText(message.status)} • {formatDistanceToNow(message.timestamp, { addSuffix: true })}
                      </p>
                    </div>
                    {message.blockNumber && (
                      <span className="text-[9px] sm:text-[10px] font-mono text-muted-foreground">
                        #{message.blockNumber}
                      </span>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Legend */}
          <div className="flex items-center justify-center gap-3 sm:gap-4 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border/50 text-[9px] sm:text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1">
              <CheckCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-success" />
              <span>Verified</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-primary" />
              <span>Pending</span>
            </div>
            <div className="flex items-center gap-1">
              <XCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-destructive" />
              <span>Failed</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
