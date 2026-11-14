"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bitcoin, ChevronRight } from "lucide-react";
import { WalletButton } from "./WalletButton";

export function Navbar() {
  const pathname = usePathname();
  const section = pathname === "/" ? "New invoice" : pathname === "/invoices" ? "My invoices" : pathname.startsWith("/pay/") ? "Invoice checkout" : "Workspace";
  return <header className="site-header">
    <nav aria-label="Wallet navigation" className="nav-inner">
      <Link href="/" className="brand mobile-brand" aria-label="MezoPay home">
        <span className="brand-mark"><Bitcoin size={22} strokeWidth={2.5} /></span>
        <span className="brand-name">Mezo<span className="text-bitcoin">Pay</span></span>
      </Link>
      <div className="workspace-breadcrumb"><span>Workspace</span><ChevronRight size={14} aria-hidden="true" /><span>{section}</span></div>
      <div className="nav-wallet"><WalletButton /></div>
    </nav>
  </header>;
}
