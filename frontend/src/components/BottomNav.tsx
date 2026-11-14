"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Bitcoin, FilePlus2, ReceiptText } from "lucide-react";
import { EXPLORER_URL, MEZOPAY_ADDRESS } from "@/config/wagmi";

const tabs = [
  { href: "/", label: "New Invoice", icon: FilePlus2 },
  { href: "/invoices", label: "My Invoices", icon: ReceiptText },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  return <nav className="bottom-nav fixed bottom-0" aria-label="App navigation">
    <Link href="/" className="brand sidebar-brand" aria-label="MezoPay home">
      <span className="brand-mark"><Bitcoin size={22} strokeWidth={2.5} /></span>
      <span className="brand-name">Mezo<span className="text-bitcoin">Pay</span></span>
    </Link>
    <p className="sidebar-label">PAYMENTS</p>
    {tabs.map(({ href, label, icon: Icon }) => {
      const active = pathname === href;
      return <Link key={href} href={href} aria-current={active ? "page" : undefined}
        className={`bottom-tab min-h-12 ${active ? "bottom-tab-active" : ""}`}>
        <Icon size={22} strokeWidth={active ? 2.3 : 1.7} aria-hidden="true" />
        <span>{label}</span>
      </Link>;
    })}
    <div className="sidebar-meta"><div className="sidebar-network"><span className="h-2 w-2 rounded-full bg-mint" />Mezo Testnet</div>
      <p>Testnet assets only</p>
      <a href={`${EXPLORER_URL}/address/${MEZOPAY_ADDRESS}`} target="_blank" rel="noopener noreferrer">Invoice contract<ArrowUpRight size={14} /><span className="sr-only"> (opens in a new tab)</span></a>
    </div>
  </nav>;
}
