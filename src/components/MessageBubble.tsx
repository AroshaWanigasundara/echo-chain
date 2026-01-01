import { motion } from "framer-motion";
import { Lock, Check, CheckCheck, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ChatMessage } from "@/lib/types";

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const getStatusIcon = () => {
    switch (message.status) {
      case "sending":
        return <div className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />;
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={`flex ${message.isMine ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`
          max-w-[75%] px-4 py-2 rounded-2xl relative group
          ${message.isMine 
            ? "message-bubble-sent" 
            : "message-bubble-received"
          }
        `}
      >
        <p className="text-sm whitespace-pre-wrap break-words">
          {message.content}
        </p>
        
        <div className={`
          flex items-center gap-1.5 mt-1
          ${message.isMine ? "justify-end" : "justify-start"}
        `}>
          {message.encrypted && (
            <Lock className="h-2.5 w-2.5 opacity-60" />
          )}
          <span className="text-[10px] opacity-60">
            {formatDistanceToNow(message.timestamp, { addSuffix: true })}
          </span>
          {message.isMine && (
            <span className="opacity-60">
              {getStatusIcon()}
            </span>
          )}
        </div>

        {/* Hash tooltip on hover */}
        {message.hash && (
          <div className="absolute bottom-full left-0 mb-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <div className="bg-popover text-popover-foreground px-2 py-1 rounded text-[10px] font-mono shadow-lg max-w-[200px] truncate">
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
          <div className="h-2 w-2 rounded-full bg-current animate-typing" />
          <div className="h-2 w-2 rounded-full bg-current animate-typing" />
        </div>
      </div>
    </div>
  );
}
