import { Moon, Sun, Shield } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { WalletConnect } from "@/components/WalletConnect";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { useTheme } from "@/hooks/useTheme";
import { APP_NAME } from "@/lib/constants";

export function Header() {
  const { theme, toggleTheme } = useTheme();

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="sticky top-0 z-50 w-full border-b border-border/50 glass-strong"
    >
      <div className="container flex h-16 items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 rounded-lg bg-primary/30 blur-md" />
            <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Shield className="h-5 w-5" />
            </div>
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight gradient-text">
              {APP_NAME}
            </h1>
            <ConnectionStatus />
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-9 w-9"
          >
            <motion.div
              initial={false}
              animate={{ rotate: theme === "dark" ? 0 : 180 }}
              transition={{ duration: 0.3 }}
            >
              {theme === "dark" ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4" />
              )}
            </motion.div>
          </Button>
          <WalletConnect />
        </div>
      </div>
    </motion.header>
  );
}
