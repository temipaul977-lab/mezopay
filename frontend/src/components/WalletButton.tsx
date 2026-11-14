"use client";

import { useEffect, useState } from "react";
import { LogOut, Wallet } from "lucide-react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { mezoTestnet } from "@/config/wagmi";
import { errorMessage, shortAddress } from "@/lib/invoices";
import { ErrorNotice, Spinner } from "./ui";

export function WalletButton({ compact = false }: { compact?: boolean }) {
  const [mounted, setMounted] = useState(false);
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connect, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching, error: switchError } = useSwitchChain();
  useEffect(() => setMounted(true), []);

  if (!mounted) return <button className="btn-secondary" disabled><Wallet size={16} />Connect Wallet</button>;

  if (isConnected && address) return <div className="wallet-controls">
    {chainId !== mezoTestnet.id && <button className="btn-warning" disabled={switching}
      onClick={() => switchChain({ chainId: mezoTestnet.id })}>
      {switching && <Spinner />}Switch to Mezo Testnet
    </button>}
    <button type="button" className="btn-secondary" title={`Disconnect ${address}`} onClick={() => disconnect()}>
      <span className="h-2 w-2 rounded-full bg-mint" />
      <span>{compact ? "Disconnect Wallet" : shortAddress(address)}</span><LogOut size={14} />
      {!compact && <span className="sr-only">Disconnect Wallet</span>}
    </button>
    {switchError && <p role="alert" className="wallet-error">{errorMessage(switchError)}</p>}
  </div>;

  return <div className="relative">
    <button type="button" className="btn-primary" disabled={isPending || !connectors.length}
      onClick={() => connectors[0] && connect({ connector: connectors[0], chainId: mezoTestnet.id })}>
      {isPending ? <Spinner /> : <Wallet size={16} />}{isPending ? "Connecting…" : "Connect Wallet"}
    </button>
    {error && <div className="wallet-error"><ErrorNotice>{errorMessage(error)} Install or unlock MetaMask, Rabby, or an injected wallet.</ErrorNotice></div>}
  </div>;
}
