import { motion } from "framer-motion";
import { Activity, Wifi, WifiOff, Database, Clock } from "lucide-react";
import { useBlockchain } from "@/contexts/BlockchainContext";
import { RPC_ENDPOINT } from "@/lib/constants";

export function ConnectionStatus() {
  const { blockchainState } = useBlockchain();

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-4 text-xs text-muted-foreground"
    >
      {/* Connection Status */}
      <div className="flex items-center gap-1.5">
        {blockchainState.connecting ? (
          <>
            <div className="h-2 w-2 rounded-full bg-warning animate-pulse" />
            <span>Connecting...</span>
          </>
        ) : blockchainState.connected ? (
          <>
            <Wifi className="h-3 w-3 text-success" />
            <span className="text-success">Connected</span>
          </>
        ) : (
          <>
            <WifiOff className="h-3 w-3 text-destructive" />
            <span className="text-destructive">Disconnected</span>
          </>
        )}
      </div>

      {/* Block Number */}
      {blockchainState.connected && (
        <div className="flex items-center gap-1.5">
          <Database className="h-3 w-3" />
          <span>Block #{blockchainState.blockNumber.toLocaleString()}</span>
        </div>
      )}

      {/* RPC Endpoint */}
      <div className="hidden md:flex items-center gap-1.5">
        <Activity className="h-3 w-3" />
        <span className="font-mono truncate max-w-[200px]">{RPC_ENDPOINT}</span>
      </div>
    </motion.div>
  );
}
