import { ArrowUpRight } from "lucide-react";
import { EXPLORER_URL, MEZOPAY_ADDRESS } from "@/config/wagmi";

export function Footer() {
  return <footer className="site-footer">
    <span className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-mint" />Mezo Testnet · Test assets only</span>
    <a href={`${EXPLORER_URL}/address/${MEZOPAY_ADDRESS}`} target="_blank" rel="noopener noreferrer">
      Invoice contract<ArrowUpRight size={14} /><span className="sr-only"> (opens in a new tab)</span>
    </a>
  </footer>;
}
