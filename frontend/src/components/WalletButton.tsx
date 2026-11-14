"use client";

import { useEffect, useRef, useState } from "react";
import { Check, LogOut, Wallet, X } from "lucide-react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { mezoTestnet } from "@/config/wagmi";
import { errorMessage, shortAddress } from "@/lib/invoices";
import { CopyButton, ErrorNotice, ExplorerLink, Spinner } from "./ui";

export function WalletButton({ compact = false }: { compact?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [mounted, setMounted] = useState(false);
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<string[]>([]);
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connectAsync, isPending, error, reset } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching, error: switchError } = useSwitchChain();
  useEffect(() => setMounted(true), []);

  async function open() {
    reset();
    dialog.current?.showModal();
    if (isConnected) return;
    setChecking(true);
    try {
      const providers = await Promise.all(connectors.map(async (connector) => {
        try { return (await connector.getProvider()) ? connector.uid : null; } catch { return null; }
      }));
      setAvailable(providers.filter((uid): uid is string => uid !== null));
    } finally { setChecking(false); }
  }

  return <div className="wallet-controls">
    {mounted && isConnected && chainId !== mezoTestnet.id && <button className="btn-warning" disabled={switching}
      onClick={() => switchChain({ chainId: mezoTestnet.id })}>{switching && <Spinner />}Switch to Mezo Testnet</button>}
    <button type="button" className={mounted && isConnected ? "btn-secondary wallet-trigger" : "btn-primary wallet-trigger"}
      disabled={!mounted} onClick={() => void open()} aria-haspopup="dialog">
      <Wallet size={16} />{mounted && isConnected && address ? compact ? "Wallet settings" : shortAddress(address) : "Connect wallet"}
    </button>
    {switchError && <p role="alert" className="wallet-error">{errorMessage(switchError)}</p>}
    <dialog ref={dialog} className="wallet-dialog" aria-label={isConnected ? "Connected wallet" : "Connect a wallet"}
      onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="dialog-header"><h2>{isConnected ? "Your wallet" : "Connect a wallet"}</h2><button type="button" className="btn-ghost" onClick={() => dialog.current?.close()} aria-label="Close wallet dialog"><X size={20} /></button></div>
      {isConnected && address ? <div className="space-y-4">
        <p className="wallet-address">{address}</p>
        <p className="flex items-center gap-2 text-sm text-slate-300"><Check size={16} className="text-mint" />{chainId === mezoTestnet.id ? "Connected to Mezo Testnet" : "Connected to another network"}</p>
        {chainId !== mezoTestnet.id && <button className="btn-warning w-full" disabled={switching} onClick={() => switchChain({ chainId: mezoTestnet.id })}>{switching && <Spinner />}Switch to Mezo Testnet</button>}
        <div className="flex flex-wrap items-center gap-4"><CopyButton value={address} label="Copy address" /><ExplorerLink value={address} type="address">View wallet</ExplorerLink></div>
        <button className="btn-secondary w-full" onClick={() => { disconnect(); dialog.current?.close(); }}><LogOut size={16} />Disconnect wallet</button>
      </div> : <>
        <p className="dialog-description">Choose a wallet. MezoPay uses Mezo Testnet and never receives your private keys.</p>
        {checking ? <p className="flex items-center gap-2 py-5 text-sm" role="status"><Spinner />Looking for wallets…</p>
          : !available.length ? <div className="warning-notice">No injected wallet detected. On desktop, install and unlock MetaMask or Rabby. On mobile, open MezoPay in your wallet&apos;s built-in browser.<button className="block underline" onClick={() => void open()}>Check again</button></div>
          : <div className="wallet-options">{connectors.filter((connector) => available.includes(connector.uid)).map((connector) =>
            <button key={connector.uid} className="btn-secondary" disabled={isPending} onClick={async () => {
              try { await connectAsync({ connector }); dialog.current?.close(); } catch { /* Error is displayed below. */ }
            }}><Wallet size={20} />{connector.name === "Injected" ? "Browser wallet" : connector.name}{isPending && <Spinner />}</button>)}
          </div>}
        {error && <ErrorNotice>{errorMessage(error)}</ErrorNotice>}
      </>}
      {switchError && <ErrorNotice>{errorMessage(switchError)}</ErrorNotice>}
    </dialog>
  </div>;
}
