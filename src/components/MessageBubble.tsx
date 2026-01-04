import { motion } from "framer-motion";
import { 
  Lock, 
  Check, 
  CheckCheck, 
  AlertTriangle, 
  Clock,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Loader2
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ChatMessage } from "@/lib/types";
import { BLOCKS_PER_DAY } from "@/lib/constants";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface MessageBubbleProps {
  message: ChatMessage;
  currentBlockNumber?: number;
  onVerifyClick?: (message: ChatMessage) => void;
  isVerifying?: boolean;
}

export function MessageBubble({ 
  message, 
  currentBlockNumber,
  onVerifyClick,
  isVerifying 
}: MessageBubbleProps) {
  
  const getMessageStatusIcon = () => {
    switch (message.status) {
      case "sending":
        return <Loader2 className="h-3 w-3 animate-spin" />;
      case "sent":
        return <Check className="h-3 w-3" />;
      case "verified":
        return <CheckCheck className="h-3 w-3 text-primary" />;
      case "failed":
        return <AlertTriangle className="h-3 w-3 text-destructive" />;
      default:
        return null;
    }
  };

  const getVerificationIcon = () => {
    if (isVerifying) {
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />;
    }
    if (message.expired) {
      return <Clock className="h-3.5 w-3.5 text-warning" />;
    }
    if (message.verified) {
      return <ShieldCheck className="h-3.5 w-3.5 text-success" />;
    }
    return <Shield className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  const getVerificationTooltip = () => {
    if (isVerifying) return "Verifying...";
    if (message.expired) return "Expired - Cannot verify";
    if (message.verified) return "Verified on blockchain";
    return "Click to verify";
  };

  // Calculate expiry info
  const getExpiryInfo = () => {
    if (!message.blockNumber || !currentBlockNumber) return null;
    
    const expiryBlocks = 7 * BLOCKS_PER_DAY; // 7 days in blocks
    const expiryBlock = message.blockNumber + expiryBlocks;
    const blocksRemaining = expiryBlock - currentBlockNumber;
    
    if (blocksRemaining <= 0) {
      return { expired: true, text: "Expired", urgent: true };
    }
    
    const daysRemaining = Math.floor(blocksRemaining / BLOCKS_PER_DAY);
    const hoursRemaining = Math.floor((blocksRemaining % BLOCKS_PER_DAY) / (BLOCKS_PER_DAY / 24));
    
    if (daysRemaining === 0) {
      return { 
        expired: false, 
        text: `Expires in ${hoursRemaining}h`, 
        urgent: true 
      };
    }
    
    if (daysRemaining <= 1) {
      return { 
        expired: false, 
        text: `Expires in ${daysRemaining}d ${hoursRemaining}h`, 
        urgent: true 
      };
    }
    
    return { 
      expired: false, 
      text: `Expires in ${daysRemaining} days`, 
      urgent: false 
    };
  };

  const expiryInfo = getExpiryInfo();
  const canVerify = !message.expired && message.status !== "sending" && message.status !== "failed";

  const handleClick = () => {
    if (canVerify && onVerifyClick) {
      onVerifyClick(message);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={`flex ${message.isMine ? "justify-end" : "justify-start"}`}
    >
      <div
        onClick={handleClick}
        className={`
          max-w-[75%] px-4 py-2 rounded-2xl relative group
          ${message.isMine 
            ? "message-bubble-sent" 
            : "message-bubble-received"
          }
          ${canVerify ? "cursor-pointer hover:ring-2 ring-primary/30 transition-all" : ""}
          ${message.verified ? "ring-1 ring-success/30" : ""}
          ${message.expired ? "opacity-70" : ""}
        `}
      >
        <p className="text-sm whitespace-pre-wrap break-words">
          {message.content}
        </p>
        
        <div className={`
          flex items-center gap-1.5 mt-1 flex-wrap
          ${message.isMine ? "justify-end" : "justify-start"}
        `}>
          {/* Encryption Lock */}
          {message.encrypted && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Lock className="h-2.5 w-2.5 opacity-60" />
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">End-to-end encrypted</p>
              </TooltipContent>
            </Tooltip>
          )}
          
          {/* Timestamp */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-[10px] opacity-60">
                {formatDistanceToNow(message.timestamp, { addSuffix: true })}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="text-xs">
                {format(message.timestamp, "PPpp")}
              </p>
            </TooltipContent>
          </Tooltip>
          
          {/* Message Status (for sent messages) */}
          {message.isMine && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="opacity-60">
                  {getMessageStatusIcon()}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs capitalize">{message.status}</p>
              </TooltipContent>
            </Tooltip>
          )}
          
          {/* Verification Status */}
          {message.blockNumber && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="ml-1">
                  {getVerificationIcon()}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">{getVerificationTooltip()}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Expiry Badge */}
        {expiryInfo && message.blockNumber && (
          <div className={`
            absolute -bottom-5 ${message.isMine ? "right-0" : "left-0"}
            text-[9px] px-1.5 py-0.5 rounded-full
            ${expiryInfo.expired 
              ? "bg-destructive/20 text-destructive" 
              : expiryInfo.urgent 
                ? "bg-warning/20 text-warning" 
                : "bg-muted text-muted-foreground"
            }
          `}>
            {expiryInfo.text}
          </div>
        )}

        {/* Hash tooltip on hover */}
        {message.hash && (
          <div className="absolute bottom-full left-0 mb-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            <div className="bg-popover text-popover-foreground px-2 py-1 rounded text-[10px] font-mono shadow-lg max-w-[200px] truncate border border-border">
              Hash: {message.hash.slice(0, 16)}...
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="message-bubble-received px-4 py-3 rounded-2xl">
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-current animate-typing" />
          <div className="h-2 w-2 rounded-full bg-current animate-typing" style={{ animationDelay: "0.2s" }} />
          <div className="h-2 w-2 rounded-full bg-current animate-typing" style={{ animationDelay: "0.4s" }} />
        </div>
      </div>
    </div>
  );
}