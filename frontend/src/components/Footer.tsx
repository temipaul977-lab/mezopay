import { ArrowUpRight, Bitcoin } from "lucide-react";
import { EXPLORER_URL, MEZOPAY_ADDRESS } from "@/config/wagmi";

export function Footer() {
  return <footer className="site-footer">
    <div className="flex items-center gap-2 text-sm"><Bitcoin size={17} className="text-bitcoin" />Built on Bitcoin. Powered by Mezo.</div>
    <div className="flex flex-wrap items-center gap-5 text-xs">
      <span className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-mint" />Mezo Testnet · 31611</span>
      <a className="inline-flex items-center gap-1 hover:text-bitcoin" href={`${EXPLORER_URL}/address/${MEZOPAY_ADDRESS}`} target="_blank" rel="noopener noreferrer">View contract<ArrowUpRight size={13} /></a>
      <span>Testnet assets only</span>
    </div>
  </footer>;
}
