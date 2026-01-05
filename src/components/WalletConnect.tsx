import { motion } from "framer-motion";
import { Wallet, ChevronDown, LogOut, Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBlockchain } from "@/contexts/BlockchainContext";
import { truncateKey } from "@/lib/encryption";

export function WalletConnect() {
  const { walletState, connectWallet, disconnectWallet, selectAccount } = useBlockchain();
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    if (walletState.address) {
      await navigator.clipboard.writeText(walletState.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!walletState.connected) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
      >
        <Button
          onClick={connectWallet}
          className="gap-1 sm:gap-2 bg-primary text-primary-foreground hover:bg-primary/90 glow text-xs sm:text-sm px-2 sm:px-4 h-8 sm:h-10"
        >
          <Wallet className="h-4 w-4" />
          <span className="hidden sm:inline">Connect Wallet</span>
          <span className="sm:hidden">Connect</span>
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-1 sm:gap-2 glass border-primary/30 hover:border-primary/60 text-xs sm:text-sm px-2 sm:px-4 h-8 sm:h-10">
            <div className="flex items-center gap-1 sm:gap-2">
              <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
              <span className="font-mono text-xs sm:text-sm">
                {truncateKey(walletState.address || "")}
              </span>
              {walletState.balance && (
                <span className="text-muted-foreground text-xs sm:text-sm hidden sm:inline">
                  {walletState.balance} UNIT
                </span>
              )}
            </div>
            <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 glass-strong">
          <div className="px-2 py-2">
            <p className="text-xs text-muted-foreground mb-1">Connected Account</p>
            <div className="flex items-center gap-2">
              <p className="font-mono text-sm truncate flex-1">
                {walletState.address}
              </p>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={copyAddress}
              >
                {copied ? (
                  <Check className="h-3 w-3 text-success" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
            {walletState.balance && (
              <p className="text-sm text-primary mt-1">
                Balance: {walletState.balance} UNIT
              </p>
            )}
          </div>
          
          {walletState.accounts.length > 1 && (
            <>
              <DropdownMenuSeparator />
              <p className="px-2 py-1 text-xs text-muted-foreground">
                Switch Account
              </p>
              {walletState.accounts.map((account) => (
                <DropdownMenuItem
                  key={account.address}
                  onClick={() => selectAccount(account.address)}
                  className={account.address === walletState.address ? "bg-primary/10" : ""}
                >
                  <span className="font-mono text-sm truncate">
                    {account.meta.name || truncateKey(account.address)}
                  </span>
                </DropdownMenuItem>
              ))}
            </>
          )}
          
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={disconnectWallet}
            className="text-destructive focus:text-destructive"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </motion.div>
  );
}
