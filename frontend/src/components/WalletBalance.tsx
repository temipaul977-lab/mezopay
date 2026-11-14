"use client";

import { useAccount, useReadContract } from "wagmi";
import { mezoTestnet, MUSD_ADDRESS } from "@/config/wagmi";
import { musdAbi } from "@/contracts/abis";
import { musdAmount } from "@/lib/invoices";

export function WalletBalance() {
  const { address, isConnected } = useAccount();
  const balance = useReadContract({
    address: MUSD_ADDRESS, abi: musdAbi, functionName: "balanceOf",
    args: address ? [address] : undefined, chainId: mezoTestnet.id,
    query: { enabled: !!address && isConnected, refetchInterval: 15_000 },
  });

  return <section className="wallet-balance rounded-2xl" aria-label="Your MUSD balance">
    <div className="balance-copy"><p>MUSD wallet balance <span className="balance-network">Mezo Testnet</span></p>
      {isConnected && address ? balance.isError ? <div className="balance-unavailable">Balance unavailable<button onClick={() => void balance.refetch()}>Retry</button></div>
        : <div className="balance-value"><span>{balance.data === undefined ? "…" : musdAmount(balance.data)}</span><span>MUSD</span></div>
        : <div className="balance-disconnected">Connect to view your MUSD</div>}
    </div>
    <span className="balance-symbol" aria-hidden="true">M</span>
  </section>;
}
