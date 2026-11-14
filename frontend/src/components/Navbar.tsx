import Link from "next/link";
import { Bitcoin } from "lucide-react";
import { WalletButton } from "./WalletButton";

export function Navbar() {
  return <header className="site-header">
    <nav aria-label="Wallet navigation" className="nav-inner">
      <Link href="/" className="brand" aria-label="MezoPay home">
        <span className="brand-mark"><Bitcoin size={22} strokeWidth={2.5} /></span>
        <span className="brand-name">Mezo<span className="text-bitcoin">Pay</span></span>
      </Link>
      <div className="nav-wallet"><WalletButton /></div>
    </nav>
  </header>;
}
