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
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Verification
              </CardTitle>
              <CardDescription>Message hash verification status</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleVerifyAll}
              disabled={isVerifying}
              className="gap-2"
            >
              {isVerifying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Verify
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Block Info */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 mb-4">
            <span className="text-sm text-muted-foreground">Current Block</span>
            <span className="font-mono text-primary">
              #{blockchainState.blockNumber.toLocaleString()}
            </span>
          </div>

          {/* Message Status List */}
          <ScrollArea className="h-[200px]">
            {recentMessages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Shield className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No messages to verify</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentMessages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/30 transition-colors"
                  >
                    {getStatusIcon(message.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono truncate">
                        {truncateKey(message.hash)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {getStatusText(message.status)} • {formatDistanceToNow(message.timestamp, { addSuffix: true })}
                      </p>
                    </div>
                    {message.blockNumber && (
                      <span className="text-[10px] font-mono text-muted-foreground">
                        #{message.blockNumber}
                      </span>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-border/50 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3 text-success" />
              <span>Verified</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-primary" />
              <span>Pending</span>
            </div>
            <div className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-destructive" />
              <span>Failed</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
