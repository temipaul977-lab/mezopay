"use client";

import Link from "next/link";
import { ArrowUpRight, Bitcoin } from "lucide-react";
import { useAccount, useReadContract } from "wagmi";
import { mezoTestnet, MUSD_ADDRESS, EXPLORER_URL, MEZOPAY_ADDRESS } from "@/config/wagmi";
import { musdAbi } from "@/contracts/abis";
import { musdAmount } from "@/lib/invoices";
import { WalletButton } from "./WalletButton";

export function Navbar() {
  const { address, isConnected } = useAccount();
  const balance = useReadContract({
    address: MUSD_ADDRESS, abi: musdAbi, functionName: "balanceOf",
    args: address ? [address] : undefined, chainId: mezoTestnet.id,
    query: { enabled: !!address && isConnected, refetchInterval: 15_000 },
  });

  return <header className="site-header">
    <nav aria-label="Main navigation" className="nav-inner">
      <Link href="/" className="brand" aria-label="MezoPay home">
        <span className="brand-mark"><Bitcoin size={26} strokeWidth={2.5} /></span>
        <span><span className="brand-name">Mezo<span className="text-bitcoin">Pay</span></span>
          <span className="brand-caption">Bitcoin-Backed MUSD Invoicing</span></span>
      </Link>
      <div className="nav-links">
        <Link href="/#dashboard" className="hover:text-white">Invoices</Link>
        <a href={`${EXPLORER_URL}/address/${MEZOPAY_ADDRESS}`} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 hover:text-white">Contract<ArrowUpRight size={14} /></a>
      </div>
      <div className="nav-wallet">
        {isConnected && address && <div className="balance-badge" title={balance.data !== undefined ? `${musdAmount(balance.data)} MUSD` : "MUSD balance"}>
          <span className="token-mini">$</span>
          <span className="max-w-36 truncate font-mono text-xs">{balance.isError ? "Unavailable" : balance.data === undefined ? "…" : musdAmount(balance.data)}</span>
          <span className="text-xs text-slate-400">MUSD</span>
        </div>}
        <WalletButton />
      </div>
    </nav>
  </header>;
}
