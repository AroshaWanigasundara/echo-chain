import { motion } from "framer-motion";
import { Activity, Wifi, WifiOff, Database, Radio, Users } from "lucide-react";
import { useBlockchain } from "@/contexts/BlockchainContext";
import { useLibp2p } from "@/contexts/Libp2pContext";
import { RPC_ENDPOINT } from "@/lib/constants";

export function ConnectionStatus() {
  const { blockchainState } = useBlockchain();
  const { isP2PConnected, isP2PConnecting, peerCount } = useLibp2p();

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-4 text-xs text-muted-foreground"
    >
      {/* Blockchain Connection Status */}
      <div className="flex items-center gap-1.5">
        {blockchainState.connecting ? (
          <>
            <div className="h-2 w-2 rounded-full bg-warning animate-pulse" />
            <span>Connecting...</span>
          </>
        ) : blockchainState.connected ? (
          <>
            <Wifi className="h-3 w-3 text-success" />
            <span className="text-success">Chain</span>
          </>
        ) : (
          <>
            <WifiOff className="h-3 w-3 text-destructive" />
            <span className="text-destructive">Disconnected</span>
          </>
        )}
      </div>

      {/* P2P Connection Status */}
      <div className="flex items-center gap-1.5">
        {isP2PConnecting ? (
          <>
            <div className="h-2 w-2 rounded-full bg-warning animate-pulse" />
            <span>P2P...</span>
          </>
        ) : isP2PConnected ? (
          <>
            <Radio className="h-3 w-3 text-success" />
            <span className="text-success">P2P</span>
          </>
        ) : (
          <>
            <Radio className="h-3 w-3 text-muted-foreground" />
            <span>P2P Off</span>
          </>
        )}
      </div>

      {/* Peer Count */}
      {isP2PConnected && peerCount > 0 && (
        <div className="flex items-center gap-1.5">
          <Users className="h-3 w-3" />
          <span>{peerCount} peers</span>
        </div>
      )}

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
